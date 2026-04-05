// Cisco IOS config parser — extracts structured elements for preview

// Patterns to strip from raw terminal/show-run output
const TERMINAL_NOISE = [
  /^[\w\-]+[#>]\s*show\s+run.*/i,          // e.g. "CDGCOREDMZ#show run"
  /^[\w\-]+[#>]\s*$/,                        // bare prompts like "Switch#"
  /^Building configuration\.\.\./i,           // "Building configuration..."
  /^Current configuration\s*:\s*\d+\s*bytes/i, // "Current configuration : 12345 bytes"
  /^!\s*Last configuration change.*/i,        // "! Last configuration change at..."
  /^!\s*NVRAM config last updated.*/i,        // "! NVRAM config last updated..."
  /^Using \d+ out of \d+.*/i,                // "Using 12345 out of 65536 bytes"
  /^Uncompressed configuration.*/i,           // "Uncompressed configuration..."
  /^!\s*No configuration change since.*/i,
  /^Press RETURN to continue/i,
  /^--\s*More\s*--/,                          // pager output
  /^\s*$/,                                    // blank lines (collapsed later)
]

/**
 * Clean raw Cisco config by stripping terminal prompts, show-command headers,
 * pager output, and excessive blank lines.
 * @param {string} rawConfig
 * @returns {string} cleaned config
 */
export function cleanCiscoConfig(rawConfig) {
  const lines = rawConfig.split('\n')
  const cleaned = []
  let prevBlank = false

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // Skip lines matching terminal noise patterns
    if (TERMINAL_NOISE.some((re) => re.test(line))) {
      // Allow a single blank line between blocks, collapse multiples
      if (/^\s*$/.test(line)) {
        if (!prevBlank) { cleaned.push(''); prevBlank = true }
      }
      continue
    }

    prevBlank = line === ''
    cleaned.push(line)
  }

  // Trim leading/trailing blank lines
  const result = cleaned.join('\n').trim()
  return result
}

// Patterns that indicate terminal/PuTTY preamble before actual config
const TERMINAL_PREAMBLE_INDICATORS = [
  /PuTTY log/i,
  /login\s*(as)?:/i,
  /[Uu]sername\s*:/,
  /[Pp]assword\s*:/,
  /keyboard-interactive/i,
  /show\s+run/i,
  /Building configuration/i,
  /[#>]\s*$/,                // CLI prompts like "Switch#"
]

/**
 * Strip PuTTY log headers, terminal login/auth lines, show commands, and other
 * preamble that precedes the actual configuration.
 * Returns { config, stripped } where stripped=true if terminal output was removed.
 * @param {string} rawText
 * @returns {{ config: string, stripped: boolean }}
 */
export function stripTerminalOutput(rawText) {
  const lines = rawText.split('\n')

  // Find the start of actual config: 'version X.X' or '!' followed by config lines
  let configStart = -1
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (/^version\s+\d/.test(trimmed)) {
      configStart = i
      break
    }
    if (trimmed === '!' && i + 1 < lines.length) {
      const next = lines[i + 1].trim()
      if (/^version\s+\d/.test(next) || /^hostname\s/.test(next) || next === '!') {
        configStart = i
        break
      }
    }
  }

  // Nothing to strip — config starts at beginning or not found
  if (configStart <= 0) return { config: rawText, stripped: false }

  // Only strip if the preamble actually contains terminal output indicators
  const preamble = lines.slice(0, configStart).join('\n')
  if (!TERMINAL_PREAMBLE_INDICATORS.some((re) => re.test(preamble))) {
    return { config: rawText, stripped: false }
  }

  return {
    config: lines.slice(configStart).join('\n').trimEnd(),
    stripped: true,
  }
}

/**
 * Parse a Cisco IOS / IOS-XE configuration string into structured elements.
 * @param {string} configText
 * @returns {{ vlans, interfaces, routingProtocols, dhcpHelpers, portChannels, stpConfig }}
 */
export function parseCiscoConfig(configText) {
  const lines = configText.split('\n').map((l) => l.trimEnd())

  return {
    vlans: parseVlans(lines),
    interfaces: parseInterfaces(lines),
    routingProtocols: parseRoutingProtocols(lines),
    dhcpHelpers: parseDhcpHelpers(lines),
    portChannels: parsePortChannels(lines),
    stpConfig: parseStp(lines),
  }
}

function parseVlans(lines) {
  const vlans = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^vlan (\d+(?:,\d+)*)$/)
    if (!m) continue
    const ids = m[1].split(',')
    let name = null
    if (i + 1 < lines.length) {
      const nm = lines[i + 1].match(/^\s+name\s+(.+)$/)
      if (nm) name = nm[1]
    }
    ids.forEach((id) => vlans.push({ id: id.trim(), name }))
  }
  return vlans
}

function parseInterfaces(lines) {
  const interfaces = []
  let current = null
  for (const line of lines) {
    const ifMatch = line.match(/^interface\s+(.+)$/)
    if (ifMatch) {
      if (current) interfaces.push(current)
      current = { name: ifMatch[1], description: null, mode: null, vlan: null, trunk: null, ipAddress: null, shutdown: false }
      continue
    }
    if (!current) continue

    if (line.match(/^[^\s]/)) { current = null; continue }

    const desc = line.match(/^\s+description\s+(.+)$/)
    if (desc) { current.description = desc[1]; continue }

    if (line.match(/^\s+switchport mode access/)) { current.mode = 'access'; continue }
    if (line.match(/^\s+switchport mode trunk/)) { current.mode = 'trunk'; continue }

    const accessVlan = line.match(/^\s+switchport access vlan (\d+)/)
    if (accessVlan) { current.vlan = accessVlan[1]; continue }

    const trunkVlan = line.match(/^\s+switchport trunk allowed vlan (.+)/)
    if (trunkVlan) { current.trunk = trunkVlan[1]; continue }

    const ip = line.match(/^\s+ip address (\S+)\s+(\S+)/)
    if (ip) { current.ipAddress = `${ip[1]}/${maskToCidr(ip[2])}`; continue }

    if (line.match(/^\s+shutdown/)) { current.shutdown = true; continue }
  }
  if (current) interfaces.push(current)
  return interfaces
}

function parseRoutingProtocols(lines) {
  const protocols = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^router ospf/)) protocols.push({ type: 'OSPF', line: lines[i] })
    if (lines[i].match(/^router bgp/)) protocols.push({ type: 'BGP', line: lines[i] })
    if (lines[i].match(/^router eigrp/)) protocols.push({ type: 'EIGRP', line: lines[i] })
    if (lines[i].match(/^ip route /)) protocols.push({ type: 'Static', line: lines[i] })
  }
  return protocols
}

function parseDhcpHelpers(lines) {
  const helpers = []
  for (const line of lines) {
    const m = line.match(/^\s+ip helper-address\s+(\S+)/)
    if (m) helpers.push(m[1])
  }
  return [...new Set(helpers)]
}

function parsePortChannels(lines) {
  const pcs = []
  for (const line of lines) {
    const m = line.match(/^interface Port-channel(\d+)/)
    if (m) pcs.push({ id: m[1] })
  }
  return pcs
}

function parseStp(lines) {
  const stpLines = lines.filter((l) => l.match(/^spanning-tree/))
  return stpLines.length > 0 ? { enabled: true, lines: stpLines } : { enabled: false, lines: [] }
}

function maskToCidr(mask) {
  const parts = mask.split('.').map(Number)
  let cidr = 0
  for (const p of parts) {
    let n = p
    while (n > 0) { cidr += n & 1; n >>= 1 }
  }
  return cidr
}
