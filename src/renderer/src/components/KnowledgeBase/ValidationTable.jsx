import { useState, useMemo } from 'react'

const CATEGORIES = ['vlan', 'interface', 'routing', 'aaa', 'stp', 'lag', 'other']
const CONFIDENCES = ['high', 'medium', 'low']
const STATUSES = ['approved', 'needs_review', 'rejected']

/**
 * Validation table for reviewing command mappings before saving.
 * Props:
 *   rows: [{ id, source_command, target_command, category, confidence, status, notes }]
 *   onChange: (updatedRows) => void
 *   onSave: (approvedRows) => void
 *   saving: boolean
 */
export default function ValidationTable({ rows, onChange, onSave, saving }) {
  const [filterCat, setFilterCat] = useState('')
  const [filterConf, setFilterConf] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [editingCell, setEditingCell] = useState(null) // { idx, field }

  // Stats
  const approved = rows.filter((r) => r.status === 'approved').length
  const needsReview = rows.filter((r) => r.status === 'needs_review').length
  const rejected = rows.filter((r) => r.status === 'rejected').length

  // Filtered rows
  const filtered = useMemo(() => {
    return rows.filter((r, i) => {
      if (filterCat && r.category !== filterCat) return false
      if (filterConf && r.confidence !== filterConf) return false
      if (filterStatus && r.status !== filterStatus) return false
      if (search) {
        const s = search.toLowerCase()
        if (!r.source_command.toLowerCase().includes(s) && !r.target_command.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [rows, filterCat, filterConf, filterStatus, search])

  function updateRow(idx, field, value) {
    const updated = [...rows]
    const realIdx = rows.indexOf(filtered[idx])
    if (realIdx >= 0) {
      updated[realIdx] = { ...updated[realIdx], [field]: value }
      onChange(updated)
    }
  }

  function bulkSetStatus(conf, status) {
    const updated = rows.map((r) => r.confidence === conf ? { ...r, status } : r)
    onChange(updated)
  }

  function addRow() {
    onChange([...rows, {
      id: `new_${Date.now()}`,
      source_command: '',
      target_command: '',
      category: 'other',
      confidence: 'medium',
      status: 'needs_review',
      notes: '',
    }])
  }

  function removeRow(idx) {
    const realIdx = rows.indexOf(filtered[idx])
    if (realIdx >= 0) {
      const updated = [...rows]
      updated.splice(realIdx, 1)
      onChange(updated)
    }
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="badge-success">{approved} approved</span>
        <span className="badge-warning">{needsReview} needs review</span>
        <span className="badge-critical">{rejected} rejected</span>
        <span className="text-xs text-text-muted">of {rows.length} total</span>
      </div>

      {/* Filters + bulk actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input text-xs w-48 py-1" placeholder="Search commands…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-xs w-28 py-1" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input text-xs w-24 py-1" value={filterConf} onChange={(e) => setFilterConf(e.target.value)}>
          <option value="">All confidence</option>
          {CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input text-xs w-28 py-1" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn-ghost text-[10px]" onClick={() => bulkSetStatus('high', 'approved')}>Approve all high</button>
        <button className="btn-ghost text-[10px]" onClick={() => bulkSetStatus('low', 'rejected')}>Reject all low</button>
        <button className="btn-ghost text-[10px]" onClick={addRow}>+ Add row</button>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[400px] border border-border rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-surface-3 sticky top-0 z-10">
            <tr>
              <th className="text-left px-2 py-1.5 text-text-muted font-medium w-20">Category</th>
              <th className="text-left px-2 py-1.5 text-text-muted font-medium">Source Command</th>
              <th className="text-left px-2 py-1.5 text-text-muted font-medium">Target Command</th>
              <th className="text-left px-2 py-1.5 text-text-muted font-medium w-16">Conf.</th>
              <th className="text-left px-2 py-1.5 text-text-muted font-medium w-24">Status</th>
              <th className="text-center px-2 py-1.5 text-text-muted font-medium w-12">Del</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-text-muted italic">No mappings to show</td></tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={row.id ?? i} className="hover:bg-surface-2">
                  {/* Category */}
                  <td className="px-2 py-1">
                    <select className="bg-transparent text-xs text-text-secondary w-full" value={row.category} onChange={(e) => updateRow(i, 'category', e.target.value)}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  {/* Source command — click to edit */}
                  <td className="px-2 py-1">
                    <EditableCell value={row.source_command} editing={editingCell?.idx === i && editingCell?.field === 'source'}
                      onStartEdit={() => setEditingCell({ idx: i, field: 'source' })}
                      onEndEdit={(v) => { updateRow(i, 'source_command', v); setEditingCell(null) }}
                      className="font-mono text-accent-red" />
                  </td>
                  {/* Target command */}
                  <td className="px-2 py-1">
                    <EditableCell value={row.target_command} editing={editingCell?.idx === i && editingCell?.field === 'target'}
                      onStartEdit={() => setEditingCell({ idx: i, field: 'target' })}
                      onEndEdit={(v) => { updateRow(i, 'target_command', v); setEditingCell(null) }}
                      className="font-mono text-accent-green" />
                  </td>
                  {/* Confidence */}
                  <td className="px-2 py-1">
                    <ConfidenceBadge value={row.confidence} onChange={(v) => updateRow(i, 'confidence', v)} />
                  </td>
                  {/* Status */}
                  <td className="px-2 py-1">
                    <StatusSelect value={row.status} onChange={(v) => updateRow(i, 'status', v)} />
                  </td>
                  {/* Delete */}
                  <td className="text-center px-2 py-1">
                    <button className="text-text-muted hover:text-accent-red text-xs" onClick={() => removeRow(i)}>✕</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Save */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-text-muted">
          Only <span className="text-accent-green font-medium">{approved} approved</span> rows will be saved
        </p>
        <button className="btn-primary" disabled={approved === 0 || saving} onClick={() => onSave(rows.filter((r) => r.status === 'approved'))}>
          {saving ? 'Saving…' : `Save ${approved} to Knowledge Base`}
        </button>
      </div>
    </div>
  )
}

function EditableCell({ value, editing, onStartEdit, onEndEdit, className }) {
  if (editing) {
    return (
      <input
        autoFocus
        className="input text-xs py-0.5 px-1 font-mono w-full"
        defaultValue={value}
        onBlur={(e) => onEndEdit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onEndEdit(e.target.value) }}
      />
    )
  }
  return (
    <span className={`cursor-pointer hover:underline ${className}`} onClick={onStartEdit}>
      {value || <span className="italic text-text-muted">click to edit</span>}
    </span>
  )
}

function ConfidenceBadge({ value, onChange }) {
  const colors = { high: 'badge-success', medium: 'badge-warning', low: 'badge-critical' }
  return (
    <select
      className={`text-[10px] rounded px-1 py-0.5 border cursor-pointer bg-transparent
        ${value === 'high' ? 'text-accent-green border-accent-green/30' :
          value === 'medium' ? 'text-accent-yellow border-accent-yellow/30' :
          'text-accent-red border-accent-red/30'}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  )
}

function StatusSelect({ value, onChange }) {
  return (
    <select
      className={`text-[10px] rounded px-1 py-0.5 bg-transparent cursor-pointer
        ${value === 'approved' ? 'text-accent-green' :
          value === 'rejected' ? 'text-accent-red' :
          'text-accent-yellow'}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="approved">Approved</option>
      <option value="needs_review">Needs Review</option>
      <option value="rejected">Rejected</option>
    </select>
  )
}
