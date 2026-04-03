import { useState } from 'react'
import { useMigrations } from '../../hooks/useMigrations'

export default function SavePanel({
  vendorPair,
  sourceConfig,
  convertedConfig,
  conversionResult,
  corrections,
  onReset,
}) {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [notes, setNotes] = useState('')
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved | error
  const [saveError, setSaveError] = useState('')
  const [exported, setExported] = useState(false)
  const [copied, setCopied] = useState(false)

  const { approveMigration } = useMigrations()

  async function handleSave() {
    if (!rating) return
    setSaveStatus('saving')
    setSaveError('')
    try {
      await approveMigration({
        sourceConfig,
        convertedConfig,
        sourceVendor: vendorPair.source,
        targetVendor: vendorPair.target,
        accuracyRating: rating,
        corrections,
        conversionSummary: conversionResult?.summary ?? null,
        warnings: conversionResult?.warnings ?? [],
        notes: notes.trim() || null,
      })
      setSaveStatus('saved')
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err.message)
    }
  }

  async function handleExport() {
    const vendorName = vendorPair.target.shortName.toLowerCase().replace(/\s+/g, '-')
    const ts = new Date().toISOString().slice(0, 10)
    const saved = await window.electronAPI?.file.save({
      content: convertedConfig,
      defaultName: `${vendorName}-config-${ts}.txt`,
    })
    if (saved) setExported(true)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(convertedConfig)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  if (saveStatus === 'saved') {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="card p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-accent-green/15 border border-accent-green/30 flex items-center justify-center mx-auto">
            <CheckIcon />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Migration Saved</h2>
            <p className="text-sm text-text-secondary mt-1">
              {vendorPair.source.shortName} → {vendorPair.target.shortName} · {rating}★ accuracy
            </p>
            <p className="text-xs text-text-muted mt-1">
              This migration is now available as a learning example for future conversions
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button className="btn-secondary" onClick={handleExport}>
              {exported ? '✓ Exported' : 'Export .txt'}
            </button>
            <button className="btn-secondary" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy to clipboard'}
            </button>
            <button className="btn-primary" onClick={onReset}>
              Start New Migration
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-slide-in">
      {/* Rating */}
      <div className="card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Rate Conversion Accuracy</h3>
          <p className="text-xs text-text-muted mt-1">
            How accurately did Claude convert the config? Your rating improves future conversions.
          </p>
        </div>
        <div
          className="flex items-center gap-2"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              className="transition-transform duration-75 hover:scale-110 active:scale-95"
              onMouseEnter={() => setHovered(n)}
              onClick={() => setRating(n)}
            >
              <StarIcon filled={n <= (hovered || rating)} />
            </button>
          ))}
          {(hovered || rating) > 0 && (
            <span className="text-sm text-text-secondary ml-2">
              {ratingLabel(hovered || rating)}
            </span>
          )}
        </div>
      </div>

      {/* Corrections summary */}
      {corrections > 0 && (
        <div className="flex items-center gap-2 text-xs text-text-secondary card px-4 py-3">
          <EditIcon />
          <span>
            You made edits to the converted config — {corrections} correction{corrections !== 1 ? 's' : ''} tracked
          </span>
        </div>
      )}

      {/* Notes */}
      <div className="card p-5 space-y-2">
        <label className="text-sm font-medium text-text-primary">Notes (optional)</label>
        <textarea
          className="input h-20 resize-none"
          placeholder="Any observations about the conversion quality, issues found, or manual corrections made…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {saveStatus === 'error' && (
          <div className="badge-critical w-full text-sm p-3 rounded-lg">
            Save failed: {saveError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            className="btn-primary flex-1"
            disabled={!rating || saveStatus === 'saving'}
            onClick={handleSave}
          >
            {saveStatus === 'saving' ? (
              <span className="animate-pulse-subtle">Saving…</span>
            ) : (
              <>
                <SaveIcon />
                Save to Supabase
              </>
            )}
          </button>
          <button className="btn-secondary" onClick={handleExport}>
            {exported ? '✓ Exported' : 'Export .txt'}
          </button>
          <button className="btn-secondary" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {!rating && (
          <p className="text-xs text-text-muted text-center">
            Select a star rating to enable Save
          </p>
        )}
      </div>
    </div>
  )
}

function ratingLabel(n) {
  return ['', 'Poor — many issues', 'Fair — significant manual work', 'Good — minor tweaks', 'Very good — small fixes', 'Perfect — no changes needed'][n]
}

function StarIcon({ filled }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24"
      fill={filled ? '#d29922' : 'none'}
      stroke={filled ? '#d29922' : '#484f58'}
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
      stroke="#3fb950" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-accent-yellow flex-shrink-0"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}
