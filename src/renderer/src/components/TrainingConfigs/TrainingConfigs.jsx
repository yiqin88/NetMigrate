import { useState, useEffect, useRef } from 'react'
import { VENDORS, MIGRATION_PAIRS } from '../../constants/vendors'

export default function TrainingConfigs() {
  const [examples, setExamples] = useState([])
  const [counts, setCounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // list | add

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
    if (!confirm('Delete this training pair? This cannot be undone.')) return
    try {
      await window.electronAPI?.training?.delete(id)
      refresh()
    } catch (err) {
      console.error('[training] delete failed:', err)
    }
  }

  async function handleUpdate(id, updates) {
    try {
      await window.electronAPI?.training?.update(id, updates)
      refresh()
    } catch (err) {
      console.error('[training] update failed:', err)
    }
  }

  const totalMappings = examples.reduce(
    (sum, ex) => sum + (ex.command_mappings?.length ?? 0), 0
  )
  const vendorPairs = [...new Set(counts.map((c) => c.pair))]

  return (
    <section className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color="#8957e5" label="T" />
          <h2 className="text-sm font-semibold text-text-primary">Training Configs</h2>
        </div>
        <button
          className="btn-ghost text-xs"
          onClick={() => setView(view === 'list' ? 'add' : 'list')}
        >
          {view === 'add' ? '← Back to list' : '+ Add training pair'}
        </button>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatChip label="Training pairs" value={examples.length} color="purple" />
        <StatChip label="Command mappings" value={totalMappings} color="blue" />
        <StatChip label="Vendor pairs" value={vendorPairs.length} color="green" />
      </div>

      <p className="text-xs text-text-muted">
        Upload known-good config pairs to teach Claude the correct translation patterns.
        Command mappings are automatically extracted on save.
      </p>

      {view === 'add' ? (
        <TrainingForm
          onSaved={() => { setView('list'); refresh() }}
          onCancel={() => setView('list')}
        />
      ) : (
        <TrainingList
          examples={examples}
          loading={loading}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}
    </section>
  )
}

// ── Summary chip ──────────────────────────────────────────────────────────────

function StatChip({ label, value, color }) {
  const colors = {
    purple: 'bg-accent-purple/15 text-accent-purple border-accent-purple/25',
    blue: 'bg-accent-blue/15 text-accent-blue border-accent-blue/25',
    green: 'bg-accent-green/15 text-accent-green border-accent-green/25',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${colors[color]}`}>
      <span className="font-bold">{value}</span> {label}
    </span>
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
  const [savingMsg, setSavingMsg] = useState('')
  const [error, setError] = useState('')
  const srcFileRef = useRef(null)
  const tgtFileRef = useRef(null)

  function readFile(file, setter) {
    const reader = new FileReader()
    reader.onload = (e) => setter(e.target.result)
    reader.readAsText(file)
  }

  async function handleSave() {
    if (!sourceConfig.trim() || !convertedConfig.trim()) {
      setError('Both source and converted configs are required.')
      return
    }
    setSaving(true)
    setError('')

    try {
      // 1. Save the training pair
      setSavingMsg('Saving training pair…')
      const saved = await window.electronAPI.training.save({
        source_vendor: sourceVendor,
        target_vendor: targetVendor,
        source_config: sourceConfig.trim(),
        converted_config: convertedConfig.trim(),
        description: description.trim() || null,
      })

      // 2. Extract command mappings via Claude
      setSavingMsg('Extracting command mappings with Claude…')
      const mappings = await window.electronAPI.training.extractMappings({
        sourceConfig: sourceConfig.trim(),
        convertedConfig: convertedConfig.trim(),
        sourceVendor: VENDORS[Object.keys(VENDORS).find((k) => VENDORS[k].id === sourceVendor)]?.name ?? sourceVendor,
        targetVendor: VENDORS[Object.keys(VENDORS).find((k) => VENDORS[k].id === targetVendor)]?.name ?? targetVendor,
      })

      // 3. Update the record with mappings
      if (mappings.length > 0) {
        setSavingMsg(`Saving ${mappings.length} command mappings…`)
        await window.electronAPI.training.update(saved.id, { command_mappings: mappings })
      }

      onSaved()
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
    setSavingMsg('')
  }

  return (
    <div className="space-y-3 bg-surface-2 rounded-lg p-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-text-secondary mb-1">Source Vendor</label>
          <select className="input text-xs" value={sourceVendor} onChange={(e) => setSourceVendor(e.target.value)}>
            {Object.values(VENDORS).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div className="flex items-end pb-2 text-text-muted">→</div>
        <div className="flex-1">
          <label className="block text-xs text-text-secondary mb-1">Target Vendor</label>
          <select className="input text-xs" value={targetVendor} onChange={(e) => setTargetVendor(e.target.value)}>
            {Object.values(VENDORS).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Description (optional)</label>
        <input className="input text-xs" placeholder="e.g. Core switch VLAN + OSPF migration" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <ConfigField label="Source Config" value={sourceConfig} onChange={setSourceConfig} fileRef={srcFileRef} onFile={(f) => readFile(f, setSourceConfig)} placeholder="Paste the source config (e.g. Cisco running-config)…" />
      <ConfigField label="Converted Config (working version)" value={convertedConfig} onChange={setConvertedConfig} fileRef={tgtFileRef} onFile={(f) => readFile(f, setConvertedConfig)} placeholder="Paste the working converted config (e.g. Aruba CX)…" />

      {error && <p className="text-xs text-accent-red">{error}</p>}
      {savingMsg && <p className="text-xs text-accent-blue animate-pulse-subtle">{savingMsg}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <button className="btn-secondary text-xs" onClick={onCancel}>Cancel</button>
        <button className="btn-primary text-xs" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Training Pair'}
        </button>
      </div>
    </div>
  )
}

function ConfigField({ label, value, onChange, fileRef, onFile, placeholder }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-text-secondary">{label}</label>
        <button type="button" className="btn-ghost text-xs py-0.5" onClick={() => fileRef.current?.click()}>
          Upload file
        </button>
        <input ref={fileRef} type="file" accept=".txt,.cfg,.conf,.log" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      <textarea className="input font-mono text-xs h-28 resize-none" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
      {value && <span className="text-xs text-text-muted">{value.length.toLocaleString()} chars</span>}
    </div>
  )
}

// ── Card list ─────────────────────────────────────────────────────────────────

function TrainingList({ examples, loading, onDelete, onUpdate }) {
  if (loading) return <p className="text-xs text-text-muted animate-pulse-subtle py-4 text-center">Loading…</p>

  if (examples.length === 0) {
    return (
      <div className="text-center py-6 text-text-muted text-xs">
        No training examples yet. Click "+ Add training pair" to get started.
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {examples.map((ex) => (
        <TrainingCard key={ex.id} example={ex} onDelete={onDelete} onUpdate={onUpdate} />
      ))}
    </div>
  )
}

function TrainingCard({ example, onDelete, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVendorSrc, setEditVendorSrc] = useState(example.source_vendor)
  const [editVendorTgt, setEditVendorTgt] = useState(example.target_vendor)
  const [editDesc, setEditDesc] = useState(example.description ?? '')

  const mappings = example.command_mappings ?? []
  const srcVendor = Object.values(VENDORS).find((v) => v.id === example.source_vendor)
  const tgtVendor = Object.values(VENDORS).find((v) => v.id === example.target_vendor)

  async function handleEditSave() {
    await onUpdate(example.id, {
      source_vendor: editVendorSrc,
      target_vendor: editVendorTgt,
      description: editDesc.trim() || null,
    })
    setEditing(false)
  }

  return (
    <div className="bg-surface-2 rounded-lg overflow-hidden border border-border">
      {/* Card header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: srcVendor?.color ?? '#666' }} />
          <span className="text-xs font-medium text-text-primary">
            {srcVendor?.shortName ?? example.source_vendor}
          </span>
          <span className="text-text-disabled text-xs">→</span>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tgtVendor?.color ?? '#666' }} />
          <span className="text-xs font-medium text-text-primary">
            {tgtVendor?.shortName ?? example.target_vendor}
          </span>
          {example.description && (
            <span className="text-xs text-text-muted truncate max-w-[150px] ml-1">— {example.description}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {mappings.length > 0 && (
            <span className="badge-info text-[10px] py-0">{mappings.length} mappings</span>
          )}
          <span className="text-[10px] text-text-disabled">
            {new Date(example.created_at).toLocaleDateString()}
          </span>
          <button className="btn-ghost text-[10px] py-0.5 px-1.5" onClick={() => setExpanded((e) => !e)}>
            {expanded ? '▲' : '▼'}
          </button>
          <button className="btn-ghost text-[10px] py-0.5 px-1.5" onClick={() => setEditing((e) => !e)}>
            Edit
          </button>
          <button className="btn-ghost text-[10px] py-0.5 px-1.5 hover:text-accent-red" onClick={() => onDelete(example.id)}>
            ✕
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="px-3 py-2 border-t border-border bg-surface-3 space-y-2 animate-fade-in">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] text-text-muted">Source</label>
              <select className="input text-xs py-1" value={editVendorSrc} onChange={(e) => setEditVendorSrc(e.target.value)}>
                {Object.values(VENDORS).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-text-muted">Target</label>
              <select className="input text-xs py-1" value={editVendorTgt} onChange={(e) => setEditVendorTgt(e.target.value)}>
                {Object.values(VENDORS).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <input className="input text-xs py-1" placeholder="Description" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          <div className="flex gap-1.5 justify-end">
            <button className="btn-ghost text-[10px]" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn-primary text-[10px] py-1 px-2" onClick={handleEditSave}>Save</button>
          </div>
        </div>
      )}

      {/* Command mappings */}
      {expanded && (
        <div className="border-t border-border animate-fade-in">
          {mappings.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-muted italic">No command mappings extracted yet.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-3">
                    <th className="text-left px-3 py-1.5 text-text-muted font-medium">Source Command</th>
                    <th className="text-left px-3 py-1.5 text-text-muted font-medium">Target Command</th>
                    <th className="text-left px-2 py-1.5 text-text-muted font-medium w-16">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {mappings.map((m, i) => (
                    <tr key={i} className="hover:bg-surface-2">
                      <td className="px-3 py-1 font-mono text-accent-red">{m.source}</td>
                      <td className="px-3 py-1 font-mono text-accent-green">{m.target}</td>
                      <td className="px-2 py-1 text-text-muted">{m.category ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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
