import { useState } from 'react'
import { useVendors } from '../../hooks/useVendors'
import { DEVICE_TYPES, isCrossDeviceType } from '../../constants/vendors'

export default function VendorSelector({ onConfirm }) {
  const { allProducts, sourceGroups, targetGroups } = useVendors()
  const [showAllTargets, setShowAllTargets] = useState(false)
  const [sourceId, setSourceId] = useState(null)
  const [targetId, setTargetId] = useState(null)

  const source = sourceId ? allProducts[sourceId] : null
  const target = targetId ? allProducts[targetId] : null
  const canConfirm = source && target
  const crossType = source && target && isCrossDeviceType(source.deviceType, target.deviceType)

  // Filter targets to same device type by default
  const filteredTargetGroups = (!source || showAllTargets)
    ? targetGroups
    : targetGroups.map((g) => ({
        ...g,
        products: g.products.filter((p) => p.deviceType === source.deviceType),
      })).filter((g) => g.products.length > 0)

  function handleConfirm() {
    onConfirm({ source, target })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-slide-in">
      <div className="text-sm text-text-secondary">
        Select the <span className="text-accent-yellow font-medium">source</span> product
        you're migrating from, and the <span className="text-accent-green font-medium">target</span> you're migrating to.
      </div>

      <div className="flex items-start gap-4">
        {/* Source */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-yellow">Source</span>
            <div className="h-px flex-1 bg-accent-yellow/20" />
          </div>
          <ProductPicker
            groups={sourceGroups}
            selectedId={sourceId}
            variant="source"
            onSelect={(id) => { setSourceId(id); setTargetId(null) }}
          />
        </div>

        {/* Arrow */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center pt-10 gap-2">
          <ArrowIcon active={!!sourceId} />
          {canConfirm && (
            <span className="text-xs text-accent-green font-medium animate-fade-in">Ready</span>
          )}
        </div>

        {/* Target */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-green">Target</span>
            <div className="h-px flex-1 bg-accent-green/20" />
          </div>
          {!sourceId ? (
            <div className="card p-6 text-center text-text-muted text-sm border-dashed">
              Select a source product first
            </div>
          ) : (
            <>
              <ProductPicker
                groups={filteredTargetGroups}
                selectedId={targetId}
                variant="target"
                onSelect={setTargetId}
              />
              {!showAllTargets && source && (
                <button className="btn-ghost text-[10px] w-full" onClick={() => setShowAllTargets(true)}>
                  Show all device types (currently filtering to {DEVICE_TYPES[source.deviceType]?.label ?? source.deviceType})
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Cross device type warning */}
      {crossType && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-yellow/10 border border-accent-yellow/25 text-xs text-accent-yellow">
          <span>⚠️</span>
          <span>
            Cross device type migration — {source.fullName} is a <strong>{DEVICE_TYPES[source.deviceType]?.label}</strong>,
            {' '}{target.fullName} is a <strong>{DEVICE_TYPES[target.deviceType]?.label}</strong>. This is unusual — please confirm.
          </span>
        </div>
      )}

      {/* Confirm */}
      <div className="flex justify-end pt-1">
        <button
          className="btn-primary px-6"
          disabled={!canConfirm}
          onClick={handleConfirm}
        >
          Continue with {canConfirm ? `${source.fullName} → ${target.fullName}` : 'selection'} →
        </button>
      </div>
    </div>
  )
}

// ── Grouped product picker ────────────────────────────────────────────────────

function ProductPicker({ groups, selectedId, variant, onSelect }) {
  return (
    <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
      {groups.map((group) => (
        <VendorGroup key={group.id} group={group} selectedId={selectedId} variant={variant} onSelect={onSelect} />
      ))}
    </div>
  )
}

function VendorGroup({ group, selectedId, variant, onSelect }) {
  const hasSelected = group.products.some((p) => p.id === selectedId)

  return (
    <div className="card overflow-hidden">
      {/* Vendor header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-2">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.color }}
        />
        <span className="text-xs font-semibold text-text-primary">{group.name}</span>
        <span className="text-xs text-text-disabled">({group.products.length})</span>
      </div>

      {/* Products */}
      <div className="divide-y divide-border-subtle">
        {group.products.map((product) => {
          const selected = product.id === selectedId
          const borderColor = variant === 'source'
            ? selected ? 'bg-accent-yellow/8' : 'hover:bg-surface-2'
            : selected ? 'bg-accent-green/8' : 'hover:bg-surface-2'

          return (
            <button
              key={product.id}
              onClick={() => onSelect(product.id)}
              className={`w-full text-left px-3 py-2 transition-colors ${borderColor}`}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" title={DEVICE_TYPES[product.deviceType]?.label}>{DEVICE_TYPES[product.deviceType]?.icon ?? ''}</span>
                    <span className="text-sm font-medium text-text-primary">{product.name}</span>
                    {selected && <CheckIcon color={variant === 'source' ? '#d29922' : '#3fb950'} />}
                  </div>
                  <span className="text-xs text-text-muted">{product.description}</span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ArrowIcon({ active }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#388bfd' : '#30363d'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="transition-colors duration-300">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function CheckIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
