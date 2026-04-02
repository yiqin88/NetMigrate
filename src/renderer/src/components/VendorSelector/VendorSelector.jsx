import { useState } from 'react'
import { SOURCE_VENDORS, getTargets } from '../../constants/vendors'

export default function VendorSelector({ onConfirm }) {
  const [sourceId, setSourceId] = useState(null)
  const [targetId, setTargetId] = useState(null)

  const targets = sourceId ? getTargets(sourceId) : []
  const canConfirm = sourceId && targetId

  function handleConfirm() {
    const source = SOURCE_VENDORS.find((v) => v.id === sourceId)
    const target = targets.find((v) => v.id === targetId)
    onConfirm({ source, target })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slide-in">
      <div className="text-sm text-text-secondary">
        Select the source device type you're migrating <span className="text-accent-yellow font-medium">from</span>,
        and the target you're migrating <span className="text-accent-green font-medium">to</span>.
      </div>

      <div className="flex items-start gap-6">
        {/* Source */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-yellow">Source</span>
            <div className="h-px flex-1 bg-accent-yellow/20" />
          </div>
          <div className="space-y-2">
            {SOURCE_VENDORS.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                selected={sourceId === vendor.id}
                variant="source"
                onClick={() => {
                  setSourceId(vendor.id)
                  setTargetId(null) // reset target when source changes
                }}
              />
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center pt-10 gap-2">
          <ArrowIcon active={!!sourceId} />
          {sourceId && targetId && (
            <span className="text-xs text-accent-green font-medium animate-fade-in">Ready</span>
          )}
        </div>

        {/* Target */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-green">Target</span>
            <div className="h-px flex-1 bg-accent-green/20" />
          </div>
          {!sourceId ? (
            <div className="card p-6 text-center text-text-muted text-sm border-dashed">
              Select a source vendor first
            </div>
          ) : (
            <div className="space-y-2">
              {targets.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  selected={targetId === vendor.id}
                  variant="target"
                  onClick={() => setTargetId(vendor.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Confirm */}
      <div className="flex justify-end pt-2">
        <button
          className="btn-primary px-6"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          Continue with {canConfirm ? `${SOURCE_VENDORS.find(v => v.id === sourceId)?.shortName} → ${targets.find(v => v.id === targetId)?.shortName}` : 'selection'} →
        </button>
      </div>
    </div>
  )
}

function VendorCard({ vendor, selected, variant, onClick }) {
  const borderColor = variant === 'source'
    ? selected ? 'border-accent-yellow/60 bg-accent-yellow/5' : 'border-border hover:border-accent-yellow/30'
    : selected ? 'border-accent-green/60 bg-accent-green/5' : 'border-border hover:border-accent-green/30'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left card p-4 transition-all duration-150 cursor-pointer
        hover:bg-surface-2 active:scale-[0.99] ${borderColor}
        ${selected ? 'shadow-sm' : ''}`}
    >
      <div className="flex items-start gap-3">
        <VendorLogo vendor={vendor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{vendor.name}</span>
            {selected && (
              <CheckIcon color={variant === 'source' ? '#d29922' : '#3fb950'} />
            )}
          </div>
          <span className="text-xs text-text-muted">{vendor.description}</span>
          <div className="flex flex-wrap gap-1 mt-2">
            {vendor.features.slice(0, 4).map((f) => (
              <span key={f} className="text-xs px-1.5 py-0.5 rounded bg-surface-4 text-text-secondary">
                {f}
              </span>
            ))}
            {vendor.features.length > 4 && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-surface-4 text-text-muted">
                +{vendor.features.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

function VendorLogo({ vendor }) {
  // Colored initial badge as placeholder — real SVG logos added later
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
      style={{ backgroundColor: vendor.color + '25', border: `1px solid ${vendor.color}40` }}
    >
      <span style={{ color: vendor.color }}>{vendor.vendor[0]}</span>
    </div>
  )
}

function ArrowIcon({ active }) {
  return (
    <svg
      width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#388bfd' : '#30363d'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="transition-colors duration-300"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function CheckIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
