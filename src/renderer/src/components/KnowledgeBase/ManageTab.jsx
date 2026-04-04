import { useState, useEffect, useRef, useMemo } from 'react'
import { useVendors } from '../../hooks/useVendors'

const ALL_CATEGORIES = [
  'vlan', 'interface', 'routing', 'aaa', 'stp', 'lag', 'qos', 'lldp',
  'security-policy', 'nat', 'zones', 'vpn-ipsec', 'vpn-ssl', 'security-profiles',
  'ha', 'ssid', 'rf-profile', 'other',
]
const CONFIDENCES = ['high', 'medium', 'low']
const SOURCE_TYPES = { doc_upload: 'Doc Upload', web_search: 'Web Search', manual: 'Manual', training: 'Training' }

export default function ManageTab({ onUpdate }) {
  const { allProducts } = useVendors()
  const [allEntries, setAllEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [filterConf, setFilterConf] = useState('')
  const [filterSrcProd, setFilterSrcProd] = useState('')
  const [filterTgtProd, setFilterTgtProd] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const importRef = useRef(null)

  useEffect(() => { refresh() }, [])

  async function refresh() {
    setLoading(true)
    const data = await window.electronAPI?.kb?.list({}) ?? []
    setAllEntries(data)
    setLoading(false)
  }

  // Derive unique values for filter dropdowns from actual data
  const uniqueSrcProducts = useMemo(() => [...new Set(allEntries.map((e) => e.source_product).filter(Boolean))].sort(), [allEntries])
  const uniqueTgtProducts = useMemo(() => [...new Set(allEntries.map((e) => e.target_product).filter(Boolean))].sort(), [allEntries])
  const uniqueCategories = useMemo(() => [...new Set(allEntries.map((e) => e.category).filter(Boolean))].sort(), [allEntries])
  const uniqueOrigins = useMemo(() => [...new Set(allEntries.map((e) => e.source_type).filter(Boolean))].sort(), [allEntries])

  // Client-side filtering
  const entries = useMemo(() => {
    return allEntries.filter((e) => {
      if (filterCat && e.category !== filterCat) return false
      if (filterConf && e.confidence !== filterConf) return false
      if (filterSrcProd && e.source_product !== filterSrcProd) return false
      if (filterTgtProd && e.target_product !== filterTgtProd) return false
      if (filterOrigin && e.source_type !== filterOrigin) return false
      if (search) {
        const s = search.toLowerCase()
        if (!e.source_command?.toLowerCase().includes(s) && !e.target_command?.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [allEntries, filterCat, filterConf, filterSrcProd, filterTgtProd, filterOrigin, search])

  const hasFilters = filterCat || filterConf || filterSrcProd || filterTgtProd || filterOrigin || search

  function resetFilters() {
    setFilterCat(''); setFilterConf(''); setFilterSrcProd(''); setFilterTgtProd(''); setFilterOrigin(''); setSearch('')
  }

  function getProductLabel(productId) {
    const p = allProducts[productId]
    return p?.fullName ?? productId ?? ''
  }

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
    const csv = await window.electronAPI?.kb?.exportCSV({})
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
          source_vendor: row.source_vendor ?? '', source_product: row.source_product ?? '',
          target_vendor: row.target_vendor ?? '', target_product: row.target_product ?? '',
          source_command: row.source_command, target_command: row.target_command,
          category: row.category || 'other', confidence: row.confidence || 'medium',
          verified_by_human: true, source_type: 'manual', notes: row.notes || null,
        })
      }
    }
    if (rows.length > 0) {
      await window.electronAPI?.kb?.saveBatch(rows)
      refresh(); onUpdate?.()
      alert(`Imported ${rows.length} mappings`)
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters row 1: search + product filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <input className="input text-xs w-44 py-1" placeholder="Search commands…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <select className="input text-xs py-1" style={{ maxWidth: 140 }} value={filterSrcProd} onChange={(e) => setFilterSrcProd(e.target.value)}>
          <option value="">All source products</option>
          {uniqueSrcProducts.map((p) => <option key={p} value={p}>{getProductLabel(p)}</option>)}
        </select>
        <span className="text-text-muted text-xs">→</span>
        <select className="input text-xs py-1" style={{ maxWidth: 140 }} value={filterTgtProd} onChange={(e) => setFilterTgtProd(e.target.value)}>
          <option value="">All target products</option>
          {uniqueTgtProducts.map((p) => <option key={p} value={p}>{getProductLabel(p)}</option>)}
        </select>
      </div>

      {/* Filters row 2: category + confidence + origin + actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className="input text-xs w-28 py-1" value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">All categories</option>
          {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input text-xs w-24 py-1" value={filterConf} onChange={(e) => setFilterConf(e.target.value)}>
          <option value="">All confidence</option>
          {CONFIDENCES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input text-xs w-28 py-1" value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value)}>
          <option value="">All origins</option>
          {uniqueOrigins.map((o) => <option key={o} value={o}>{SOURCE_TYPES[o] ?? o}</option>)}
        </select>
        {hasFilters && (
          <button className="btn-ghost text-[10px] text-accent-blue" onClick={resetFilters}>Reset filters</button>
        )}
        <div className="flex-1" />
        <button className="btn-ghost text-[10px]" onClick={handleExportCSV}>Export CSV</button>
        <button className="btn-ghost text-[10px]" onClick={() => importRef.current?.click()}>Import CSV</button>
        <input ref={importRef} type="file" accept=".csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleImportCSV(e.target.files[0])} />
        <span className="text-xs text-text-muted">
          {hasFilters ? `Showing ${entries.length} of ${allEntries.length}` : `${allEntries.length}`} entries
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-xs text-text-muted animate-pulse-subtle py-4 text-center">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-text-muted py-6 text-center">
          {hasFilters ? 'No mappings match current filters.' : 'No mappings found. Use the Analyse tab to add some.'}
        </p>
      ) : (
        <div className="overflow-auto max-h-[400px] border border-border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-surface-3 sticky top-0 z-10">
              <tr>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium w-20">Category</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium">Source Cmd</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium">Target Cmd</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium w-14">Conf</th>
                <th className="text-left px-2 py-1.5 text-text-muted font-medium w-16">Origin</th>
                <th className="text-center px-2 py-1.5 text-text-muted font-medium w-14">Act</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {entries.map((entry) => (
                editingId === entry.id ? (
                  <EditRow key={entry.id} data={editData} onChange={setEditData}
                    onSave={handleSaveEdit} onCancel={() => setEditingId(null)} />
                ) : (
                  <tr key={entry.id} className="hover:bg-surface-2 group">
                    <td className="px-2 py-1">
                      <div className="capitalize text-text-secondary">{entry.category}</div>
                      <div className="text-[9px] text-text-disabled leading-tight mt-0.5">
                        {getProductLabel(entry.source_product)} → {getProductLabel(entry.target_product)}
                      </div>
                    </td>
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
                    <td className="text-center px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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
