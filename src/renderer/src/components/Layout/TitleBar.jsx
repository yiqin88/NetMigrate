import { useState, useEffect } from 'react'

// macOS-style buttons are handled natively via trafficLightPosition.
// On Windows we render custom controls.
const isMac = navigator.userAgent.includes('Mac')

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.electronAPI?.window.isMaximized().then(setIsMaximized)
  }, [])

  return (
    <div
      className="h-11 flex items-center justify-between flex-shrink-0
        bg-surface-1 border-b border-border select-none"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left: macOS spacer or app identity */}
      <div className="flex items-center gap-2 px-4">
        {isMac && <div className="w-14" />} {/* traffic light spacer */}
        <NetMigrateIcon />
        <span className="text-sm font-semibold text-text-primary tracking-tight">
          NetMigrate
        </span>
        <span className="text-xs text-text-muted font-mono ml-1">
          v{__APP_VERSION__}
        </span>
      </div>

      {/* Center: drag region label */}
      <div className="absolute left-1/2 -translate-x-1/2 text-xs text-text-muted pointer-events-none">
        Network Config Migration Tool
      </div>

      {/* Right: Windows controls (hidden on macOS) */}
      {!isMac && (
        <div
          className="flex items-center h-full"
          style={{ WebkitAppRegion: 'no-drag' }}
        >
          <WinButton
            title="Minimize"
            onClick={() => window.electronAPI?.window.minimize()}
          >
            <MinimizeIcon />
          </WinButton>
          <WinButton
            title={isMaximized ? 'Restore' : 'Maximize'}
            onClick={async () => {
              await window.electronAPI?.window.maximize()
              const m = await window.electronAPI?.window.isMaximized()
              setIsMaximized(m)
            }}
          >
            {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
          </WinButton>
          <WinButton
            title="Close"
            danger
            onClick={() => window.electronAPI?.window.close()}
          >
            <CloseIcon />
          </WinButton>
        </div>
      )}
    </div>
  )
}

function WinButton({ children, onClick, title, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-11 w-11 flex items-center justify-center transition-colors
        ${danger
          ? 'hover:bg-accent-red hover:text-white text-text-secondary'
          : 'hover:bg-surface-4 text-text-secondary'
        }`}
    >
      {children}
    </button>
  )
}

function NetMigrateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="9" height="9" rx="2" fill="#388bfd" />
      <rect x="13" y="2" width="9" height="9" rx="2" fill="#3fb950" />
      <rect x="2" y="13" width="9" height="9" rx="2" fill="#3fb950" />
      <rect x="13" y="13" width="9" height="9" rx="2" fill="#388bfd" />
      <path d="M11 7h2M7 11v2M17 11v2M13 17h-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function MinimizeIcon() {
  return <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
}
function MaximizeIcon() {
  return <svg width="10" height="10" viewBox="0 0 10 10"><rect width="10" height="10" rx="1" stroke="currentColor" fill="none" /></svg>
}
function RestoreIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <rect x="2" y="0" width="8" height="8" rx="1" stroke="currentColor" fill="none" />
      <rect x="0" y="2" width="8" height="8" rx="1" stroke="currentColor" fill="none" className="fill-surface-1" />
    </svg>
  )
}
function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10">
      <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

// Version injected by Vite define
const __APP_VERSION__ = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0'
