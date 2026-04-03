import { useState } from 'react'

const SEVERITIES = ['All', 'CRITICAL', 'WARNING', 'INFO']

export default function WarningsPanel({ warnings = [] }) {
  const [filter, setFilter] = useState('All')

  const counts = {
    CRITICAL: warnings.filter((w) => w.severity === 'CRITICAL').length,
    WARNING: warnings.filter((w) => w.severity === 'WARNING').length,
    INFO: warnings.filter((w) => w.severity === 'INFO').length,
  }

  const visible = filter === 'All' ? warnings : warnings.filter((w) => w.severity === filter)

  if (warnings.length === 0) {
    return (
      <div className="card p-4 flex items-center gap-3">
        <SuccessIcon />
        <div>
          <p className="text-sm font-medium text-accent-green">No warnings</p>
          <p className="text-xs text-text-muted">All elements converted successfully</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <WarningIcon />
          <span className="text-sm font-semibold text-text-primary">Conversion Warnings</span>
          <span className="text-xs text-text-muted bg-surface-4 px-1.5 py-0.5 rounded">
            {warnings.length}
          </span>
        </div>

        {/* Severity summary chips */}
        <div className="flex items-center gap-1.5">
          {counts.CRITICAL > 0 && (
            <span className="badge-critical">{counts.CRITICAL} critical</span>
          )}
          {counts.WARNING > 0 && (
            <span className="badge-warning">{counts.WARNING} warning</span>
          )}
          {counts.INFO > 0 && (
            <span className="badge-info">{counts.INFO} info</span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 px-4 pt-2 border-b border-border">
        {SEVERITIES.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px
              ${filter === s
                ? 'border-accent-blue text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
          >
            {s}
            {s !== 'All' && counts[s] > 0 && (
              <span className="ml-1 text-text-muted">({counts[s]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Warning rows */}
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {visible.length === 0 ? (
          <p className="px-4 py-3 text-xs text-text-muted italic">
            No {filter.toLowerCase()} warnings
          </p>
        ) : (
          visible.map((w, i) => (
            <WarningRow key={i} warning={w} />
          ))
        )}
      </div>
    </div>
  )
}

function WarningRow({ warning }) {
  const [expanded, setExpanded] = useState(false)

  const badgeMap = {
    CRITICAL: 'badge-critical',
    WARNING: 'badge-warning',
    INFO: 'badge-info',
  }

  return (
    <div className="px-4 py-3 hover:bg-surface-2 transition-colors">
      <div className="flex items-start gap-3">
        <span className={`${badgeMap[warning.severity] ?? 'badge-info'} flex-shrink-0 mt-0.5`}>
          {warning.severity}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-primary">{warning.message}</p>
          {warning.original && (
            <button
              className="text-xs text-text-muted hover:text-text-secondary mt-1 transition-colors"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? '▲ Hide original' : '▼ Show original'}
            </button>
          )}
          {expanded && warning.original && (
            <pre className="mt-1.5 text-xs font-mono text-text-muted bg-surface-3 rounded px-2 py-1.5 overflow-x-auto selectable">
              {warning.original}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="#d29922" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="#3fb950" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
