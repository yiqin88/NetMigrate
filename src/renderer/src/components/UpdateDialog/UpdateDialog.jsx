import { useState, useEffect } from 'react'

export default function UpdateDialog() {
  const [update, setUpdate] = useState(null)   // { version, releaseNotes }
  const [downloaded, setDownloaded] = useState(false)
  const [progress, setProgress] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = window.electronAPI?.updater
    if (!api) return

    api.onUpdateAvailable((info) => setUpdate(info))
    api.onUpdateDownloaded((info) => { setDownloaded(true); setProgress(null) })
    api.onProgress((p) => setProgress(Math.round(p.percent)))
  }, [])

  if (!update || dismissed) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in">
      <div className="card w-full max-w-md p-6 shadow-2xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Update Available</h2>
            <p className="text-sm text-text-secondary mt-1">
              Version <span className="font-mono text-accent-blue">{update.version}</span> is ready
            </p>
          </div>
          <span className="badge-info">New Release</span>
        </div>

        {update.releaseNotes && (
          <div className="bg-surface-3 rounded-lg p-3 text-xs text-text-secondary selectable max-h-32 overflow-auto">
            {update.releaseNotes}
          </div>
        )}

        {progress !== null && (
          <div>
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Downloading…</span>
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

        <div className="flex gap-3 justify-end pt-1">
          <button
            className="btn-ghost"
            onClick={() => setDismissed(true)}
          >
            Later
          </button>
          {downloaded ? (
            <button
              className="btn-primary"
              onClick={() => window.electronAPI?.updater.install()}
            >
              Restart & Update
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={progress !== null}
              onClick={() => window.electronAPI?.updater.download()}
            >
              {progress !== null ? `${progress}%` : 'Update Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
