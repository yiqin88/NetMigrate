import { useState, useEffect } from 'react'
import DocAnalyser from './DocAnalyser'
import WebAnalyser from './WebAnalyser'
import ManageTab from './ManageTab'

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

function AnalyseTab({ onComplete }) {
  const [method, setMethod] = useState(null) // null | 'docs' | 'web'

  if (method === 'docs') return <DocAnalyser onComplete={onComplete} />
  if (method === 'web') return <WebAnalyser onComplete={onComplete} />

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">
        Choose a method to populate the knowledge base with command mappings.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button className="card p-4 space-y-2 text-left hover:bg-surface-2 transition-colors" onClick={() => setMethod('docs')}>
          <div className="flex items-center gap-2">
            <DocIcon />
            <h3 className="text-sm font-semibold text-text-primary">Upload Docs</h3>
          </div>
          <p className="text-xs text-text-muted">
            Upload source and target vendor CLI documentation (PDF/TXT). Claude analyses both and extracts command mappings per category.
          </p>
        </button>
        <button className="card p-4 space-y-2 text-left hover:bg-surface-2 transition-colors" onClick={() => setMethod('web')}>
          <div className="flex items-center gap-2">
            <SearchIcon />
            <h3 className="text-sm font-semibold text-text-primary">Auto-Generate</h3>
          </div>
          <p className="text-xs text-text-muted">
            Claude uses built-in knowledge of vendor CLIs to generate comprehensive command mappings per category with confidence ratings.
          </p>
        </button>
      </div>
    </div>
  )
}

function DocIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-accent-blue">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </svg>
}

function SearchIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-accent-green">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
}

// ManageTab imported from ./ManageTab.jsx

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
