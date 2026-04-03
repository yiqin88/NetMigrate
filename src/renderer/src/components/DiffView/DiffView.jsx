import { useState, useRef, useEffect, useMemo } from 'react'
import { buildSectionDiff } from './diffUtils'

const TYPE_LABELS = {
  global: 'Global',
  interface: 'Interface',
  vlan: 'VLAN',
  router: 'Routing',
  route: 'Static Route',
  aaa: 'AAA',
  stp: 'Spanning Tree',
  line: 'Line',
  snmp: 'SNMP',
  ntp: 'NTP',
  logging: 'Logging',
  acl: 'Access List',
  qos: 'QoS',
  banner: 'Banner',
  hostname: 'Hostname',
  dhcp: 'DHCP',
}

const TYPE_COLORS = {
  interface: 'text-accent-blue',
  vlan: 'text-accent-green',
  router: 'text-accent-yellow',
  route: 'text-accent-yellow',
  aaa: 'text-accent-purple',
  stp: 'text-accent-orange',
  global: 'text-text-muted',
}

export default function DiffView({ sourceConfig, convertedConfig, onChange, vendorPair }) {
  const [tab, setTab] = useState('diff')
  const [changedOnly, setChangedOnly] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef(null)

  const sections = useMemo(
    () => buildSectionDiff(sourceConfig, convertedConfig),
    [sourceConfig, convertedConfig]
  )

  const visibleSections = changedOnly
    ? sections.filter((s) => s.hasChanges)
    : sections

  const changedCount = sections.filter((s) => s.hasChanges).length
  const totalCount = sections.length

  useEffect(() => {
    if (tab === 'edit' && textareaRef.current) textareaRef.current.focus()
  }, [tab])

  async function handleCopy() {
    await navigator.clipboard.writeText(convertedConfig)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-1">
        <div className="flex items-center gap-4">
          {/* Tabs */}
          <div className="flex gap-0">
            {[
              { id: 'diff', label: 'Section Diff' },
              { id: 'edit', label: 'Edit Converted' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px
                  ${tab === id
                    ? 'border-accent-blue text-text-primary'
                    : 'border-transparent text-text-muted hover:text-text-secondary'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Changed-only toggle */}
          {tab === 'diff' && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={changedOnly}
                onChange={(e) => setChangedOnly(e.target.checked)}
                className="accent-accent-blue w-3 h-3"
              />
              <span className="text-xs text-text-secondary">
                Changed only ({changedCount}/{totalCount})
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-3">
          {tab === 'diff' && (
            <>
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-accent-red/60 inline-block" />
                {vendorPair?.source?.shortName ?? 'Source'}
              </span>
              <span className="text-xs text-text-muted flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-sm bg-accent-green/60 inline-block" />
                {vendorPair?.target?.shortName ?? 'Target'}
              </span>
            </>
          )}
          <button className="btn-ghost text-xs py-1 px-2" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy converted'}
          </button>
        </div>
      </div>

      {/* Content */}
      {tab === 'diff' ? (
        <div className="overflow-auto max-h-[520px]">
          {visibleSections.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-sm">
              {changedOnly ? 'No changed sections found' : 'No sections to display'}
            </div>
          ) : (
            visibleSections.map((section, si) => (
              <SectionBlock key={si} section={section} />
            ))
          )}
        </div>
      ) : (
        <div className="relative">
          <div className="absolute top-2 right-3 flex items-center gap-2 z-10">
            <span className="text-xs text-text-muted">
              {convertedConfig.split('\n').length} lines
            </span>
          </div>
          <textarea
            ref={textareaRef}
            className="w-full h-[520px] bg-surface font-mono text-xs text-text-primary
              p-4 resize-none focus:outline-none selectable leading-relaxed border-none"
            value={convertedConfig}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      )}
    </div>
  )
}

// ── Section block ─────────────────────────────────────────────────────────────

function SectionBlock({ section }) {
  const [collapsed, setCollapsed] = useState(false)
  const typeLabel = TYPE_LABELS[section.type] ?? section.type
  const typeColor = TYPE_COLORS[section.type] ?? 'text-text-secondary'

  const headerLeft = section.sourceName ?? '(not present)'
  const headerRight = section.targetName ?? '(not present)'

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Section header */}
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 bg-surface-2 hover:bg-surface-3 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <ChevronIcon open={!collapsed} />
          <span className={`text-xs font-semibold ${typeColor}`}>
            {typeLabel}
          </span>
          {section.hasChanges ? (
            <span className="badge-warning text-[10px] py-0">changed</span>
          ) : (
            <span className="text-[10px] text-text-disabled">identical</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono text-text-muted">
          <span className="max-w-[200px] truncate text-right">{headerLeft}</span>
          <span className="text-text-disabled">→</span>
          <span className="max-w-[200px] truncate">{headerRight}</span>
        </div>
      </button>

      {/* Lines */}
      {!collapsed && (
        <div className="font-mono text-xs">
          {section.lines.map((line, li) => (
            <DiffLine key={li} line={line} lineNum={li + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Diff line ─────────────────────────────────────────────────────────────────

function DiffLine({ line, lineNum }) {
  const { left, right, status } = line

  const rowBg = {
    same: '',
    changed: '',
    added: '',
    removed: '',
  }[status]

  const leftBg = {
    same: '',
    changed: 'bg-accent-red/10',
    removed: 'bg-accent-red/15',
    added: '',
  }[status]

  const rightBg = {
    same: '',
    changed: 'bg-accent-green/10',
    added: 'bg-accent-green/15',
    removed: '',
  }[status]

  const leftText = {
    same: 'text-text-muted',
    changed: 'text-text-primary',
    removed: 'text-accent-red',
    added: 'text-text-disabled',
  }[status]

  const rightText = {
    same: 'text-text-muted',
    changed: 'text-text-primary',
    added: 'text-accent-green',
    removed: 'text-text-disabled',
  }[status]

  return (
    <div className={`flex ${rowBg} border-b border-border-subtle hover:bg-surface-2/50`}>
      {/* Left (source) */}
      <div className={`flex-1 flex min-w-0 ${leftBg}`}>
        <span className="w-8 text-right pr-2 text-[10px] text-text-disabled flex-shrink-0 py-px select-none">
          {left !== null ? lineNum : ''}
        </span>
        <pre className={`flex-1 py-px px-1 whitespace-pre-wrap break-all selectable ${leftText}`}>
          {left ?? ''}
        </pre>
      </div>

      {/* Divider */}
      <div className="w-px bg-border flex-shrink-0" />

      {/* Right (target) */}
      <div className={`flex-1 flex min-w-0 ${rightBg}`}>
        <span className="w-8 text-right pr-2 text-[10px] text-text-disabled flex-shrink-0 py-px select-none">
          {right !== null ? lineNum : ''}
        </span>
        <pre className={`flex-1 py-px px-1 whitespace-pre-wrap break-all selectable ${rightText}`}>
          {right ?? ''}
        </pre>
      </div>
    </div>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-text-muted transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}
