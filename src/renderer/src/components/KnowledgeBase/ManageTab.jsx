import { useState, useEffect, useRef } from 'react'

const CATEGORIES = ['', 'vlan', 'interface', 'routing', 'aaa', 'stp', 'lag', 'other']
const CONFIDENCES = ['', 'high', 'medium', 'low']
const SOURCE_TYPES = { doc_upload: 'Doc Upload', web_search: 'Web Search', manual: 'Manual', training: 'Training' }

export default function ManageTab({ onUpdate }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [filterConf, setFilterConf] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const importRef = useRef(null)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const data = await window.electronAPI?.kb?.list({
      category: filterCat || undefined,
      confidence: filterConf || undefined,
      search: search || undefined,
    }) ?? []
    setEntries(data)
    setLoading(false)
  }

  useEffect(() => { refresh() }, [filterCat, filterConf, search])

  async function handleDelete(id) {
    if (!confirm('Delete this mapping?')) return
    await window.electronAPI?.kb?.delete(id)
    refresh()
    onUpdate?.()
  }

  async function handleSaveEdit() {
    if (!editingId) return
    await window.electronAPI?.kb?.update(editingId, editData)
    setEditingId(null)
    setEditData({})
    refresh()
    onUpdate?.()
  }

  function startEdit(entry) {
    setEditingId(entry.id)
    setEditData({
      source_command: entry.source_command,
      target_command: entry.target_command,
      category: entry.category,
      confidence: entry.confidence,
      notes: entry.notes ?? '',
    })
  }

  async function handleExportCSV() {
    const csv = await window.electronAPI?.kb?.exportCSV({
      category: filterCat || undefined,
      confidence: filterConf || undefined,
      search: search || undefined,
    })
    if (!csv) return
    await window.electronAPI?.file?.save({ content: csv, defaultName: 'knowledge-base-export.csv' })
  }

  async function handleImportCSV(file) {
    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return

    const headers = lines[0].split(',').map((h) => h.trim())
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i])
      const row = {}
      headers.forEach((h, j) => { row[h] = vals[j] ?? '' })
      if (row.source_command && row.target_command) {
        rows.push({
          source_vendor: row.source_vendor ?? '',
          source_product: row.source_product ?? '',
          target_vendor: row.target_vendor ?? '',
          target_product: row.target_product ?? '',
          source_command: row.source_command,
          target_command: row.target_command,
          category: row.category || 'other',
          confidence: row.confidence || 'medium',
          verified_by_human: true,
          source_type: 'manual',
          notes: row.notes || null,
        })
      }
    }

    if (rows.length > 0) {
      await window.electronAPI?.kb?.saveBatch(rows)
      refresh()
      onUpdate?.()
      alert(`Imported ${rows.length} mappings`)
    }
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input text-xs w-48 py-1" placeholder="Search commands…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-xs w-24 py-1" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All cats</option>
          {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input text-xs w-24 py-1" value={filterConf} onChange={(e) => setFilterConf(e.target.value)}>
          <option value="">All conf</option>
          {CONFIDENCES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn-ghost text-[10px]" onClick={handleExportCSV}>Export CSV</button>
        <button className="btn-ghost text-[10px]" onClick={() => importRef.current?.click()}>Import CSV</button>
        <input ref={importRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImportCSV(e.target.files[0])} />
        <span className="text-xs text-text-muted">{entries.length} entries</span>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-xs text-text-muted animate-pulse-subtle py-4 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-text-muted py-6 text-center">No mappings found. Use the Analyse tab to add some.</p>
      ) : (
        <div className="overflow-auto max-h-[400px] border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-surface-3 sticky top-0 z-10">
              <tr>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium w-16">Cat</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium">Source</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium">Target</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium w-14">Conf</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium w-16">Origin</th>
                <th className="text-center px-2 py-1.5 text-text-muted font-medium w-16">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                editingId === entry.id ? (
                  <EditRow key={entry.id} data={editData} onChange={setEditData}
                    onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />
                ) : (
                  <tr key={entry.id} className="hover:bg-surface-2">
                    <td className="px-2 py-1 text-text-muted capitalize">{entry.category}</td>
                    <td className="px-2 py-1 font-mono text-accent-red">{entry.source_command}</td>
                    <td className="px-2 py-1 font-mono text-accent-green">{entry.target_command}</td>
                    <td className="px-2 py-1">
                      <span className={`text-[10px] ${
                        entry.confidence === 'high' ? 'text-accent-green' :
                        entry.confidence === 'medium' ? 'text-accent-yellow' : 'text-accent-red'
                      }`}>{entry.confidence}</span>
                    </td>
                    <td className="px-2 py-1 text-text-muted text-[10px]">
                      {SOURCE_TYPES[entry.source_type] ?? entry.source_type}
                    </td>
                    <td className="text-center px-2 py-1">
                      <button className="text-text-muted hover:text-accent-blue text-[10px] mr-1" onClick={() => startEdit(entry)}>Edit</button>
                      <button className="text-text-muted hover:text-accent-red text-[10px]" onClick={() => handleDelete(entry.id)}>Del</button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EditRow({ data, onChange, onSave, onCancel }) {
  const update = (field, value) => onChange({ ...data, [field]: value })
  return (
    <tr className="bg-surface-3">
      <td className="px-2 py-1">
        <select className="bg-transparent text-xs w-full" value={data.category} onChange={(e) => update('category', e.target.value)}>
          {CATEGORIES.slice(1).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </td>
      <td className="px-2 py-1"><input className="input text-xs py-0.5 font-mono" value={data.source_command} onChange={(e) => update('source_command', e.target.value)} /></td>
      <td className="px-2 py-1"><input className="input text-xs py-0.5 font-mono" value={data.target_command} onChange={(e) => update('target_command', e.target.value)} /></td>
      <td className="px-2 py-1">
        <select className="bg-transparent text-xs" value={data.confidence} onChange={(e) => update('confidence', e.target.value)}>
          <option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
        </select>
      </td>
      <td className="px-2 py-1"><input className="input text-[10px] py-0.5" placeholder="notes" value={data.notes} onChange={(e) => update('notes', e.target.value)} /></td>
      <td className="text-center px-2 py-1">
        <button className="text-accent-green text-[10px] mr-1" onClick={onSave}>Save</button>
        <button className="text-text-muted text-[10px]" onClick={onCancel}>Cancel</button>
      </td>
    </tr>
  )
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
    current += ch
  }
  result.push(current.trim())
  return result
}
