import { NavLink } from 'react-router-dom'

const navItems = [
  {
    to: '/migrate',
    label: 'Migrate',
    icon: MigrateIcon,
    description: 'Convert configs',
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: DashboardIcon,
    description: 'Accuracy trends',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: SettingsIcon,
    description: 'API keys & prefs',
  },
]

export default function Sidebar() {
  return (
    <aside className="w-16 lg:w-56 flex flex-col flex-shrink-0 bg-surface-1 border-r border-border">
      {/* Nav items */}
      <nav className="flex flex-col gap-1 p-2 flex-1 mt-1">
        {navItems.map(({ to, label, icon: Icon, description }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150 group
               ${isActive
                 ? 'bg-accent-blue/15 text-accent-blue-hover border border-accent-blue/25'
                 : 'text-text-secondary hover:bg-surface-3 hover:text-text-primary border border-transparent'
               }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-accent-blue' : 'text-text-muted group-hover:text-text-secondary'
                  }`}
                />
                <div className="hidden lg:flex flex-col min-w-0">
                  <span className="text-sm font-medium leading-tight">{label}</span>
                  <span className="text-xs text-text-muted leading-tight mt-0.5">{description}</span>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="hidden lg:block text-xs text-text-disabled text-center">
          Multi-vendor migration
        </div>
      </div>
    </aside>
  )
}

function MigrateIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h10M4 18h7" />
      <path d="M17 15l3 3-3 3" />
      <path d="M20 18h-6" />
    </svg>
  )
}

function DashboardIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 17h7M17 14v7" />
    </svg>
  )
}

function SettingsIcon({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
