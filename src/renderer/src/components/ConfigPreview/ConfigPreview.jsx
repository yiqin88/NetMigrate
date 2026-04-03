import { useMemo, useState } from 'react'
import { parseCiscoConfig } from '../../services/configParser'

export default function ConfigPreview({ sourceConfig, vendorPair, onConfirm, onBack }) {
  const parsed = useMemo(() => parseCiscoConfig(sourceConfig), [sourceConfig])

  const stats = [
    { label: 'VLANs', count: parsed.vlans.length, icon: VlanIcon, color: 'blue' },
    { label: 'Interfaces', count: parsed.interfaces.length, icon: InterfaceIcon, color: 'green' },
    { label: 'Routing', count: parsed.routingProtocols.length, icon: RoutingIcon, color: 'yellow' },
    { label: 'DHCP Helpers', count: parsed.dhcpHelpers.length, icon: DhcpIcon, color: 'purple' },
  ]

  const totalElements =
    parsed.vlans.length +
    parsed.interfaces.length +
    parsed.routingProtocols.length +
    parsed.dhcpHelpers.length +
    parsed.portChannels.length

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-slide-in">
      {/* Summary bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Config Detected</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {totalElements} elements found in {vendorPair.source.fullName} config
          </p>
        </div>
        {totalElements === 0 && (
          <span className="badge-warning">No elements detected — check config format</span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, count, icon: Icon, color }) => (
          <StatCard key={label} label={label} count={count} Icon={Icon} color={color} />
        ))}
      </div>

      {/* Detail sections */}
      <div className="space-y-2">
        <DetailSection
          title="VLANs"
          count={parsed.vlans.length}
          color="blue"
          defaultOpen={parsed.vlans.length > 0}
        >
          {parsed.vlans.length === 0 ? (
            <EmptyRow text="No VLANs found" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {parsed.vlans.map((v) => (
                <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-3 text-xs">
                  <span className="font-mono text-accent-blue font-medium w-10 flex-shrink-0">
                    {v.id}
                  </span>
                  <span className="text-text-secondary truncate">{v.name ?? '—'}</span>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="Interfaces"
          count={parsed.interfaces.length}
          color="green"
          defaultOpen={false}
        >
          {parsed.interfaces.length === 0 ? (
            <EmptyRow text="No interfaces found" />
          ) : (
            <div className="space-y-1">
              {parsed.interfaces.map((iface, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-3 text-xs">
                  <span className="font-mono text-text-primary flex-shrink-0 w-48 truncate">
                    {iface.name}
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {iface.mode && (
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium
                        ${iface.mode === 'trunk'
                          ? 'bg-accent-blue/15 text-accent-blue'
                          : 'bg-accent-green/15 text-accent-green'
                        }`}>
                        {iface.mode}
                      </span>
                    )}
                    {iface.vlan && (
                      <span className="text-text-muted">vlan {iface.vlan}</span>
                    )}
                    {iface.trunk && (
                      <span className="text-text-muted truncate max-w-[120px]">
                        allowed: {iface.trunk}
                      </span>
                    )}
                    {iface.ipAddress && (
                      <span className="font-mono text-accent-yellow">{iface.ipAddress}</span>
                    )}
                    {iface.shutdown && (
                      <span className="px-1.5 py-0.5 rounded bg-accent-red/15 text-accent-red text-xs">
                        shutdown
                      </span>
                    )}
                    {iface.description && (
                      <span className="text-text-muted italic truncate max-w-[140px]">
                        {iface.description}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="Routing Protocols"
          count={parsed.routingProtocols.length}
          color="yellow"
          defaultOpen={parsed.routingProtocols.length > 0}
        >
          {parsed.routingProtocols.length === 0 ? (
            <EmptyRow text="No routing protocols found" />
          ) : (
            <div className="space-y-1">
              {parsed.routingProtocols.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-1.5 rounded bg-surface-3 text-xs">
                  <span className={`px-1.5 py-0.5 rounded font-medium flex-shrink-0
                    ${r.type === 'OSPF' ? 'bg-accent-blue/15 text-accent-blue' :
                      r.type === 'BGP' ? 'bg-accent-purple/15 text-accent-purple' :
                      r.type === 'Static' ? 'bg-accent-green/15 text-accent-green' :
                      'bg-surface-5 text-text-secondary'}`}>
                    {r.type}
                  </span>
                  <span className="font-mono text-text-secondary truncate">{r.line}</span>
                </div>
              ))}
            </div>
          )}
        </DetailSection>

        <DetailSection
          title="DHCP Helpers"
          count={parsed.dhcpHelpers.length}
          color="purple"
          defaultOpen={parsed.dhcpHelpers.length > 0}
        >
          {parsed.dhcpHelpers.length === 0 ? (
            <EmptyRow text="No DHCP helper addresses found" />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {parsed.dhcpHelpers.map((ip) => (
                <span key={ip} className="font-mono text-xs px-2 py-1 rounded bg-surface-3 text-accent-blue">
                  {ip}
                </span>
              ))}
            </div>
          )}
        </DetailSection>

        {parsed.portChannels.length > 0 && (
          <DetailSection title="Port-Channels" count={parsed.portChannels.length} color="green" defaultOpen>
            <div className="flex flex-wrap gap-1.5">
              {parsed.portChannels.map((pc) => (
                <span key={pc.id} className="font-mono text-xs px-2 py-1 rounded bg-surface-3 text-text-secondary">
                  Po{pc.id}
                </span>
              ))}
            </div>
          </DetailSection>
        )}

        {parsed.stpConfig.enabled && (
          <DetailSection title="Spanning Tree" count={parsed.stpConfig.lines.length} color="yellow" defaultOpen={false}>
            <div className="space-y-1">
              {parsed.stpConfig.lines.map((line, i) => (
                <div key={i} className="font-mono text-xs px-2 py-1.5 rounded bg-surface-3 text-text-secondary">
                  {line}
                </div>
              ))}
            </div>
          </DetailSection>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <button
          type="button"
          className="btn-primary px-6"
          disabled={totalElements === 0}
          onClick={onConfirm}
        >
          Convert with Claude →
        </button>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, count, Icon, color }) {
  const colorMap = {
    blue: { text: 'text-accent-blue', bg: 'bg-accent-blue/10' },
    green: { text: 'text-accent-green', bg: 'bg-accent-green/10' },
    yellow: { text: 'text-accent-yellow', bg: 'bg-accent-yellow/10' },
    purple: { text: 'text-accent-purple', bg: 'bg-accent-purple/10' },
  }
  const { text, bg } = colorMap[color] ?? colorMap.blue

  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-4 h-4 ${text}`} />
      </div>
      <div>
        <div className={`text-2xl font-bold ${text}`}>{count}</div>
        <div className="text-xs text-text-muted">{label}</div>
      </div>
    </div>
  )
}

function DetailSection({ title, count, color, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const dotColor = {
    blue: 'bg-accent-blue', green: 'bg-accent-green',
    yellow: 'bg-accent-yellow', purple: 'bg-accent-purple',
  }

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor[color] ?? 'bg-surface-5'}`} />
          <span className="text-sm font-medium text-text-primary">{title}</span>
          <span className="text-xs text-text-muted bg-surface-4 px-1.5 py-0.5 rounded">
            {count}
          </span>
        </div>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

function EmptyRow({ text }) {
  return <p className="text-xs text-text-muted italic py-1">{text}</p>
}

function ChevronIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`text-text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function VlanIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="10" rx="2" />
      <path d="M6 11h.01M10 11h.01M14 11h.01" />
    </svg>
  )
}

function InterfaceIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function RoutingIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M9 6h6l-6 6h6" />
    </svg>
  )
}

function DhcpIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}
