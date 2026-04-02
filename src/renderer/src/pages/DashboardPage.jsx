export default function DashboardPage() {
  return (
    <div className="h-full flex flex-col p-6 gap-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Accuracy Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Track AI conversion accuracy improvement over time
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Migrations" value="—" color="blue" />
        <StatCard label="Avg. Accuracy" value="—" color="green" />
        <StatCard label="Corrections Made" value="—" color="yellow" />
      </div>

      <div className="card p-8 flex-1 flex items-center justify-center">
        <div className="text-center">
          <ChartPlaceholderIcon />
          <p className="text-text-secondary text-sm mt-3">
            Accuracy chart will appear here once you have approved migrations
          </p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  const colorMap = {
    blue: 'text-accent-blue',
    green: 'text-accent-green',
    yellow: 'text-accent-yellow',
  }
  return (
    <div className="card p-4">
      <p className="text-xs text-text-muted font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${colorMap[color] ?? 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

function ChartPlaceholderIcon() {
  return (
    <svg width="64" height="48" viewBox="0 0 64 48" fill="none" className="mx-auto opacity-30">
      <rect x="0" y="32" width="8" height="16" rx="2" fill="#388bfd" />
      <rect x="14" y="24" width="8" height="24" rx="2" fill="#388bfd" />
      <rect x="28" y="16" width="8" height="32" rx="2" fill="#388bfd" />
      <rect x="42" y="8" width="8" height="40" rx="2" fill="#3fb950" />
      <rect x="56" y="4" width="8" height="44" rx="2" fill="#3fb950" />
    </svg>
  )
}
