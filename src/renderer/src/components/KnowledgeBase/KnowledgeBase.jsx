import { useState, useEffect } from 'react'

const CATEGORY_LABELS = {
  vlan: 'VLANs', interface: 'Interfaces', routing: 'Routing',
  aaa: 'AAA', stp: 'STP', lag: 'LAG', other: 'Other',
}

export default function KnowledgeBase() {
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { refreshStats() }, [])

  async function refreshStats() {
    setLoading(true)
    try {
      const s = await window.electronAPI?.kb?.stats()
      setStats(s)
    } catch (err) {
      console.error('[kb] stats failed:', err)
    }
    setLoading(false)
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color="#388bfd" label="K" />
          <h2 className="text-sm font-semibold text-text-primary">Knowledge Base</h2>
          {stats?.total > 0 && (
            <span className="badge-info text-[10px]">{stats.total} mappings</span>
          )}
        </div>
        <div className="flex gap-0">
          {['dashboard', 'analyse', 'manage'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 text-xs font-medium border-b-2 transition-colors -mb-px capitalize
                ${tab === t ? 'border-accent-blue text-text-primary' : 'border-transparent text-text-muted hover:text-text-secondary'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'dashboard' && (
        <Dashboard stats={stats} loading={loading} />
      )}

      {tab === 'analyse' && (
        <AnalyseTab onComplete={refreshStats} />
      )}

      {tab === 'manage' && (
        <ManageTab onUpdate={refreshStats} />
      )}
    </section>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({ stats, loading }) {
  if (loading) return <p className="text-xs text-text-muted animate-pulse-subtle py-4 text-center">Loading stats…</p>
  if (!stats) return <p className="text-xs text-text-muted py-4 text-center">Could not load knowledge base stats</p>

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="Total Mappings" value={stats.total} color="blue" />
        <StatCard label="Vendor Pairs" value={stats.vendorPairs?.length ?? 0} color="green" />
        <StatCard label="Human Verified" value={stats.total} color="purple" />
        <StatCard label="Last Updated" value={stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : '—'} color="yellow" small />
      </div>

      {/* By category */}
      <div>
        <h3 className="text-xs font-semibold text-text-secondary mb-2">By Category</h3>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const count = stats.byCategory?.[key] ?? 0
            return (
              <span key={key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border
                ${count > 0 ? 'bg-accent-blue/10 text-accent-blue border-accent-blue/20' : 'bg-surface-3 text-text-disabled border-border'}`}>
                {label}: <span className="font-bold">{count}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* By confidence */}
      {stats.total > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary mb-2">By Confidence</h3>
          <div className="flex gap-1.5">
            <span className="badge-success text-[10px]">{stats.byConfidence?.high ?? 0} high</span>
            <span className="badge-warning text-[10px]">{stats.byConfidence?.medium ?? 0} medium</span>
            <span className="badge-critical text-[10px]">{stats.byConfidence?.low ?? 0} low</span>
          </div>
        </div>
      )}

      {/* By source */}
      {stats.total > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-secondary mb-2">By Source</h3>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(stats.bySource ?? {}).filter(([, v]) => v > 0).map(([key, count]) => (
              <span key={key} className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-text-secondary border border-border">
                {key.replace('_', ' ')}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {stats.total === 0 && (
        <p className="text-xs text-text-muted text-center py-4">
          No command mappings yet. Go to the Analyse tab to populate the knowledge base.
        </p>
      )}
    </div>
  )
}

// ── Analyse tab (placeholder — real content in commits 3+4) ──────────────────

function AnalyseTab({ onComplete }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Choose a method to populate the knowledge base with command mappings.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Method 1: Upload Docs</h3>
          <p className="text-xs text-text-muted">
            Upload source and target vendor CLI documentation (PDF/TXT). Claude analyses both and extracts command mappings.
          </p>
          <span className="badge-info text-[10px]">Coming in next update</span>
        </div>
        <div className="card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary">Method 2: Auto-Generate</h3>
          <p className="text-xs text-text-muted">
            Claude uses built-in knowledge of vendor CLIs to generate command mappings per category.
          </p>
          <span className="badge-info text-[10px]">Coming in next update</span>
        </div>
      </div>
    </div>
  )
}

// ── Manage tab (placeholder — real content in commit 5) ──────────────────────

function ManageTab({ onUpdate }) {
  return (
    <div className="text-center py-6">
      <p className="text-xs text-text-muted">
        Knowledge base management (edit, delete, export CSV, import) will be available after adding mappings via the Analyse tab.
      </p>
    </div>
  )
}

// ── Shared ────────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, small }) {
  const colorMap = {
    blue: 'text-accent-blue', green: 'text-accent-green',
    yellow: 'text-accent-yellow', purple: 'text-accent-purple',
  }
  return (
    <div className="card p-3">
      <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider">{label}</p>
      <p className={`${small ? 'text-sm' : 'text-xl'} font-bold mt-1 ${colorMap[color] ?? 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

function Badge({ color, label }) {
  return (
    <div className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: color + '25', border: `1px solid ${color}40`, color }}>
      {label}
    </div>
  )
}
