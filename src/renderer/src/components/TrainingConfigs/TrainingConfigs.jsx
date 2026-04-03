import { useState, useEffect, useRef } from 'react'
import { VENDORS, MIGRATION_PAIRS } from '../../constants/vendors'

export default function TrainingConfigs() {
  const [examples, setExamples] = useState([])
  const [counts, setCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    try {
      const [list, ct] = await Promise.all([
        window.electronAPI?.training?.list() ?? [],
        window.electronAPI?.training?.counts() ?? [],
      ])
      setExamples(list)
      setCounts(ct)
    } catch (err) {
      console.error('[training] load failed:', err)
    }
    setLoading(false)
  }

  async function handleDelete(id) {
    try {
      await window.electronAPI?.training?.delete(id)
      setExamples((prev) => prev.filter((e) => e.id !== id))
      refresh() // refresh counts
    } catch (err) {
      console.error('[training] delete failed:', err)
    }
  }

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <VendorBadge color="#8957e5" label="T" />
          <h2 className="text-sm font-semibold text-text-primary">Training Configs</h2>
        </div>
        <button
          className="btn-ghost text-xs"
          onClick={() => setShowForm((s) => !s)}
        >
          {showForm ? '← Back to list' : '+ Add training pair'}
        </button>
      </div>

      <p className="text-xs text-text-muted">
        Upload pairs of known-good configs (source → converted) to improve conversion accuracy.
        These examples are sent to Claude before each conversion.
      </p>

      {/* Counts per vendor pair */}
      {counts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {counts.map(({ pair, count }) => (
            <span key={pair} className="badge-info">
              {pair}: {count} example{count !== 1 ? 's' : ''}
            </span>
          ))}
        </div>
      )}

      {showForm ? (
        <TrainingForm
          onSaved={() => { setShowForm(false); refresh() }}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <TrainingList
          examples={examples}
          loading={loading}
          onDelete={handleDelete}
        />
      )}
    </section>
  )
}

// ── Upload form ───────────────────────────────────────────────────────────────

function TrainingForm({ onSaved, onCancel }) {
  const [sourceVendor, setSourceVendor] = useState(MIGRATION_PAIRS[0]?.source?.id ?? '')
  const [targetVendor, setTargetVendor] = useState(MIGRATION_PAIRS[0]?.target?.id ?? '')
  const [sourceConfig, setSourceConfig] = useState('')
  const [convertedConfig, setConvertedConfig] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const sourceFileRef = useRef(null)
  const convertedFileRef = useRef(null)

  function readFile(file, setter) {
    const reader = new FileReader()
    reader.onload = (e) => setter(e.target.result)
    reader.readAsText(file)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!sourceConfig.trim() || !convertedConfig.trim()) {
      setError('Both source and converted configs are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await window.electronAPI.training.save({
        source_vendor: sourceVendor,
        target_vendor: targetVendor,
        source_config: sourceConfig.trim(),
        converted_config: convertedConfig.trim(),
        description: description.trim() || null,
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 bg-surface-2 rounded-lg p-4">
      {/* Vendor pair */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-text-secondary mb-1">Source Vendor</label>
          <select
            className="input text-xs"
            value={sourceVendor}
            onChange={(e) => setSourceVendor(e.target.value)}
          >
            {Object.values(VENDORS).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end pb-2 text-text-muted">→</div>
        <div className="flex-1">
          <label className="block text-xs text-text-secondary mb-1">Target Vendor</label>
          <select
            className="input text-xs"
            value={targetVendor}
            onChange={(e) => setTargetVendor(e.target.value)}
          >
            {Object.values(VENDORS).map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs text-text-secondary mb-1">Description (optional)</label>
        <input
          className="input text-xs"
          placeholder="e.g. Core switch VLAN + OSPF migration"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Source config */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-text-secondary">Source Config</label>
          <button
            type="button"
            className="btn-ghost text-xs py-0.5"
            onClick={() => sourceFileRef.current?.click()}
          >
            Upload file
          </button>
          <input
            ref={sourceFileRef}
            type="file"
            accept=".txt,.cfg,.conf,.log"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setSourceConfig)}
          />
        </div>
        <textarea
          className="input font-mono text-xs h-28 resize-none"
          placeholder="Paste the source config (e.g. Cisco running-config)…"
          value={sourceConfig}
          onChange={(e) => setSourceConfig(e.target.value)}
          spellCheck={false}
        />
        {sourceConfig && (
          <span className="text-xs text-text-muted">{sourceConfig.length.toLocaleString()} chars</span>
        )}
      </div>

      {/* Converted config */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-text-secondary">Converted Config (working version)</label>
          <button
            type="button"
            className="btn-ghost text-xs py-0.5"
            onClick={() => convertedFileRef.current?.click()}
          >
            Upload file
          </button>
          <input
            ref={convertedFileRef}
            type="file"
            accept=".txt,.cfg,.conf,.log"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0], setConvertedConfig)}
          />
        </div>
        <textarea
          className="input font-mono text-xs h-28 resize-none"
          placeholder="Paste the working converted config (e.g. Aruba CX config)…"
          value={convertedConfig}
          onChange={(e) => setConvertedConfig(e.target.value)}
          spellCheck={false}
        />
        {convertedConfig && (
          <span className="text-xs text-text-muted">{convertedConfig.length.toLocaleString()} chars</span>
        )}
      </div>

      {error && <p className="text-xs text-accent-red">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button type="button" className="btn-secondary text-xs" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary text-xs" disabled={saving}>
          {saving ? 'Saving…' : 'Save Training Pair'}
        </button>
      </div>
    </form>
  )
}

// ── List of saved examples ────────────────────────────────────────────────────

function TrainingList({ examples, loading, onDelete }) {
  if (loading) return <p className="text-xs text-text-muted animate-pulse-subtle">Loading…</p>

  if (examples.length === 0) {
    return (
      <div className="text-center py-4 text-text-muted text-xs">
        No training examples yet. Click "+ Add training pair" to upload your first one.
      </div>
    )
  }

  return (
    <div className="space-y-1.5 max-h-48 overflow-y-auto">
      {examples.map((ex) => (
        <div key={ex.id} className="flex items-center justify-between px-3 py-2 rounded bg-surface-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-text-muted flex-shrink-0">
              {ex.source_vendor} → {ex.target_vendor}
            </span>
            {ex.description && (
              <span className="text-text-secondary truncate">{ex.description}</span>
            )}
            <span className="text-text-disabled flex-shrink-0">
              {new Date(ex.created_at).toLocaleDateString()}
            </span>
          </div>
          <button
            className="btn-ghost text-xs text-text-muted hover:text-accent-red py-0.5 px-1.5 flex-shrink-0"
            onClick={() => onDelete(ex.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
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
