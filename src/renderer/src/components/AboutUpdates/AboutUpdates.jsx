import { useState, useEffect } from 'react'
import { setSuppressUpdateOverlay } from '../../services/updateState'

const appVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '0.0.0'

export default function AboutUpdates() {
  const [status, setStatus] = useState('idle')
  // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  const [updateInfo, setUpdateInfo] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState(null)

  useEffect(() => {
    window.electronAPI?.settings.get('update_last_checked').then((val) => {
      if (val) setLastChecked(val)
    })
  }, [])

  useEffect(() => {
    const api = window.electronAPI?.updater
    if (!api) return

    const unsubs = [
      api.onUpdateAvailable((info) => {
        setUpdateInfo(info)
        setStatus('available')
        setSuppressUpdateOverlay(false)
        refreshLastChecked()
      }),
      api.onUpdateNotAvailable((info) => {
        setUpdateInfo(info)
        setStatus('not-available')
        setSuppressUpdateOverlay(false)
        refreshLastChecked()
      }),
      api.onProgress((p) => {
        setProgress(Math.round(p.percent))
        setStatus('downloading')
      }),
      api.onUpdateDownloaded(() => {
        setStatus('downloaded')
        setProgress(null)
      }),
      api.onError((msg) => {
        setError(msg)
        setStatus('error')
        setSuppressUpdateOverlay(false)
        refreshLastChecked()
      }),
    ]

    return () => unsubs.forEach((unsub) => unsub?.())
  }, [])

  function refreshLastChecked() {
    window.electronAPI?.settings.get('update_last_checked').then((val) => {
      if (val) setLastChecked(val)
    })
  }

  async function handleCheck() {
    setStatus('checking')
    setError('')
    setUpdateInfo(null)
    setSuppressUpdateOverlay(true)
    try {
      await window.electronAPI?.updater.check()
    } catch (err) {
      setError(err.message ?? 'Check failed')
      setStatus('error')
      setSuppressUpdateOverlay(false)
    }
  }

  async function handleDownload() {
    setStatus('downloading')
    setProgress(0)
    try {
      await window.electronAPI?.updater.download()
    } catch (err) {
      setError(err.message ?? 'Download failed')
      setStatus('error')
    }
  }

  function handleInstall() {
    window.electronAPI?.updater.install()
  }

  const formattedLastChecked = lastChecked
    ? new Date(lastChecked).toLocaleString()
    : 'Never'

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VendorBadge color="#388bfd" label="U" />
          <h2 className="text-sm font-semibold text-text-primary">About & Updates</h2>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs"
          onClick={handleCheck}
          disabled={status === 'checking' || status === 'downloading'}
        >
          {status === 'checking' ? (
            <span className="animate-pulse-subtle">Checking...</span>
          ) : (
            'Check for Updates'
          )}
        </button>
      </div>

      <div className="text-sm text-text-secondary">
        <p>Version: <span className="font-mono text-text-primary">v{appVersion}</span></p>
        <p className="text-xs text-text-muted mt-1">Last checked: {formattedLastChecked}</p>
      </div>

      {status === 'not-available' && (
        <div className="badge-success w-fit animate-fade-in">
          You are on the latest version
        </div>
      )}

      {status === 'available' && updateInfo && (
        <div className="space-y-3 animate-fade-in">
          <div className="badge-info w-fit">
            Version {updateInfo.version} available
          </div>
          {updateInfo.releaseNotes && (
            <div className="bg-surface-3 rounded-lg p-3 text-xs text-text-secondary selectable max-h-32 overflow-auto">
              {typeof updateInfo.releaseNotes === 'string'
                ? updateInfo.releaseNotes
                : JSON.stringify(updateInfo.releaseNotes)}
            </div>
          )}
          {updateInfo.isMac ? (
            <button type="button" className="btn-primary text-xs" onClick={() => window.open('https://github.com/yiqin88/NetMigrate/releases/latest')}>
              Download from GitHub
            </button>
          ) : (
            <button type="button" className="btn-primary text-xs" onClick={handleDownload}>
              Download Update
            </button>
          )}
        </div>
      )}

      {status === 'downloading' && progress !== null && (
        <div className="animate-fade-in">
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Downloading...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-4 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {status === 'downloaded' && (
        <div className="space-y-2 animate-fade-in">
          <div className="badge-success w-fit">Update downloaded</div>
          <button type="button" className="btn-primary text-xs" onClick={handleInstall}>
            Restart & Install
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="badge-critical w-fit animate-fade-in">
          {error || 'Could not check for updates'}
        </div>
      )}
    </section>
  )
}

function VendorBadge({ color, label }) {
  return (
    <div
      className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: color + '25', border: `1px solid ${color}40`, color }}
    >
      {label}
    </div>
  )
}
