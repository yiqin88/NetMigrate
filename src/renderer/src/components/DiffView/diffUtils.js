// Section-aware diff utilities for network config comparison
// Parses configs into named blocks, matches them, and computes line-level diffs

// ── Block detection patterns ──────────────────────────────────────────────────

const BLOCK_STARTERS = [
  { re: /^interface\s+(.+)$/i, type: 'interface' },
  { re: /^vlan\s+(\d+.*)$/i, type: 'vlan' },
  { re: /^router\s+(\S+)\s*(.*)$/i, type: 'router' },
  { re: /^ip route\s+(.+)$/i, type: 'route' },
  { re: /^aaa\s+(.+)$/i, type: 'aaa' },
  { re: /^spanning-tree\s*(.*)$/i, type: 'stp' },
  { re: /^line\s+(.+)$/i, type: 'line' },
  { re: /^snmp-server\s+(.*)$/i, type: 'snmp' },
  { re: /^ntp\s+(.*)$/i, type: 'ntp' },
  { re: /^logging\s+(.*)$/i, type: 'logging' },
  { re: /^access-list\s+(.+)$/i, type: 'acl' },
  { re: /^ip access-list\s+(.+)$/i, type: 'acl' },
  { re: /^class-map\s+(.+)$/i, type: 'qos' },
  { re: /^policy-map\s+(.+)$/i, type: 'qos' },
  { re: /^banner\s+(.+)$/i, type: 'banner' },
  { re: /^hostname\s+(.+)$/i, type: 'hostname' },
  { re: /^ip dhcp\s+(.+)$/i, type: 'dhcp' },
]

/**
 * Parse a network config into named blocks.
 * Each block: { type, name, header, lines: string[], startLine: number }
 * Global lines (outside any block) are grouped as type='global'.
 */
export function parseConfigBlocks(text) {
  const lines = text.split('\n')
  const blocks = []
  let current = null
  let globalLines = []
  let globalStart = 0

  function flushGlobal() {
    if (globalLines.length > 0) {
      blocks.push({
        type: 'global',
        name: `global-${blocks.length}`,
        header: null,
        lines: [...globalLines],
        startLine: globalStart,
      })
      globalLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimEnd()

    // Check if this line starts a new block
    let matched = false
    for (const { re, type } of BLOCK_STARTERS) {
      const m = trimmed.match(re)
      if (m) {
        // Flush previous
        if (current) { blocks.push(current); current = null }
        flushGlobal()

        current = {
          type,
          name: m[1]?.trim() ?? '',
          header: trimmed,
          lines: [trimmed],
          startLine: i,
        }
        matched = true
        break
      }
    }

    if (matched) continue

    // Inside a block? Lines starting with whitespace or '!' are part of it
    if (current) {
      if (trimmed === '!' || trimmed === '' || trimmed.startsWith(' ') || trimmed.startsWith('\t')) {
        // '!' or blank line ends the block (common in Cisco configs)
        if (trimmed === '!') {
          current.lines.push(trimmed)
          blocks.push(current)
          current = null
        } else if (trimmed === '') {
          blocks.push(current)
          current = null
          globalLines.push(trimmed)
          globalStart = i
        } else {
          current.lines.push(trimmed)
        }
      } else {
        // Non-indented line that doesn't match a block starter — end current block
        blocks.push(current)
        current = null
        globalLines.push(trimmed)
        globalStart = i
      }
    } else {
      if (!globalLines.length) globalStart = i
      globalLines.push(trimmed)
    }
  }

  if (current) blocks.push(current)
  flushGlobal()

  return blocks
}

/**
 * Extract a normalized port number from an interface name.
 * "GigabitEthernet1/0/1" → "1/0/1", "1/1/1" → "1/1/1"
 */
function extractPortId(name) {
  const m = name.match(/(\d+(?:\/\d+)+)/)
  return m ? m[1] : name.toLowerCase().replace(/\s+/g, '')
}

/**
 * Extract VLAN IDs from a vlan block name.
 */
function extractVlanId(name) {
  const m = name.match(/^(\d+)/)
  return m ? m[1] : name
}

/**
 * Match source blocks to target blocks.
 * Returns: { matched: [{ source, target }], unmatchedSource: [], unmatchedTarget: [] }
 */
export function matchBlocks(sourceBlocks, targetBlocks) {
  const matched = []
  const usedTarget = new Set()

  // Pass 1: exact type+key matching
  for (const src of sourceBlocks) {
    if (src.type === 'global') continue

    const srcKey = getBlockKey(src)
    let bestIdx = -1

    for (let j = 0; j < targetBlocks.length; j++) {
      if (usedTarget.has(j)) continue
      const tgt = targetBlocks[j]
      if (tgt.type === 'global') continue

      const tgtKey = getBlockKey(tgt)
      if (src.type === tgt.type && srcKey === tgtKey) {
        bestIdx = j
        break
      }
    }

    if (bestIdx >= 0) {
      matched.push({ source: src, target: targetBlocks[bestIdx] })
      usedTarget.add(bestIdx)
    }
  }

  // Pass 2: type-only matching for unmatched blocks
  const matchedSourceNames = new Set(matched.map((m) => m.source.name))
  for (const src of sourceBlocks) {
    if (src.type === 'global' || matchedSourceNames.has(src.name)) continue

    for (let j = 0; j < targetBlocks.length; j++) {
      if (usedTarget.has(j)) continue
      const tgt = targetBlocks[j]
      if (tgt.type === 'global') continue
      if (src.type === tgt.type) {
        matched.push({ source: src, target: tgt })
        usedTarget.add(j)
        matchedSourceNames.add(src.name)
        break
      }
    }
  }

  // Collect unmatched
  const matchedSrcSet = new Set(matched.map((m) => m.source))
  const unmatchedSource = sourceBlocks.filter((b) => !matchedSrcSet.has(b))
  const unmatchedTarget = targetBlocks.filter((_, i) => !usedTarget.has(i) && targetBlocks[i].type !== 'global')

  // Collect global blocks
  const sourceGlobals = sourceBlocks.filter((b) => b.type === 'global')
  const targetGlobals = targetBlocks.filter((b) => b.type === 'global')

  return { matched, unmatchedSource, unmatchedTarget, sourceGlobals, targetGlobals }
}

function getBlockKey(block) {
  if (block.type === 'interface') return extractPortId(block.name)
  if (block.type === 'vlan') return extractVlanId(block.name)
  if (block.type === 'router') return block.name.split(/\s+/)[0]?.toLowerCase()
  return block.name.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Compute line-level alignment between two blocks.
 * Returns array of { left, right, status } where status = 'same' | 'changed' | 'added' | 'removed'
 */
export function alignBlockLines(leftLines, rightLines) {
  const result = []
  const maxLen = Math.max(leftLines.length, rightLines.length)

  for (let i = 0; i < maxLen; i++) {
    const left = i < leftLines.length ? leftLines[i] : null
    const right = i < rightLines.length ? rightLines[i] : null

    if (left !== null && right !== null) {
      const lNorm = left.trim().toLowerCase()
      const rNorm = right.trim().toLowerCase()
      result.push({
        left,
        right,
        status: lNorm === rNorm ? 'same' : 'changed',
      })
    } else if (left !== null) {
      result.push({ left, right: null, status: 'removed' })
    } else {
      result.push({ left: null, right, status: 'added' })
    }
  }

  return result
}

/**
 * Build the full aligned diff from two config strings.
 * Returns sections: [{ type, sourceName, targetName, lines: [{left, right, status}], hasChanges }]
 */
export function buildSectionDiff(sourceText, targetText) {
  const sourceBlocks = parseConfigBlocks(sourceText)
  const targetBlocks = parseConfigBlocks(targetText)
  const { matched, unmatchedSource, unmatchedTarget, sourceGlobals, targetGlobals } = matchBlocks(sourceBlocks, targetBlocks)

  const sections = []

  // Global lines at top
  if (sourceGlobals.length > 0 || targetGlobals.length > 0) {
    const leftLines = sourceGlobals.flatMap((g) => g.lines)
    const rightLines = targetGlobals.flatMap((g) => g.lines)
    const lines = alignBlockLines(leftLines, rightLines)
    sections.push({
      type: 'global',
      sourceName: 'Global Config',
      targetName: 'Global Config',
      lines,
      hasChanges: lines.some((l) => l.status !== 'same'),
    })
  }

  // Matched block pairs
  for (const { source, target } of matched) {
    const lines = alignBlockLines(source.lines, target.lines)
    sections.push({
      type: source.type,
      sourceName: source.header ?? source.name,
      targetName: target.header ?? target.name,
      lines,
      hasChanges: lines.some((l) => l.status !== 'same'),
    })
  }

  // Unmatched source blocks (removed)
  for (const block of unmatchedSource) {
    if (block.type === 'global') continue
    const lines = block.lines.map((l) => ({ left: l, right: null, status: 'removed' }))
    sections.push({
      type: block.type,
      sourceName: block.header ?? block.name,
      targetName: null,
      lines,
      hasChanges: true,
    })
  }

  // Unmatched target blocks (added)
  for (const block of unmatchedTarget) {
    const lines = block.lines.map((l) => ({ left: null, right: l, status: 'added' }))
    sections.push({
      type: block.type,
      sourceName: null,
      targetName: block.header ?? block.name,
      lines,
      hasChanges: true,
    })
  }

  return sections
}
