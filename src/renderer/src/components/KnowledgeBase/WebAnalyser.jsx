import { useState, useEffect } from 'react'
import { useVendors } from '../../hooks/useVendors'
import ValidationTable from './ValidationTable'

const CATEGORIES = ['vlan', 'interface', 'routing', 'aaa', 'stp', 'lag', 'other']

export default function WebAnalyser({ onComplete }) {
  const { allProducts, allGroups } = useVendors()
  const allList = Object.values(allProducts)
  const [sourceProduct, setSourceProduct] = useState(allList[0]?.id ?? '')
  const [targetProduct, setTargetProduct] = useState(allList[1]?.id ?? allList[0]?.id ?? '')
  const [analysing, setAnalysing] = useState(false)
  const [progress, setProgress] = useState({})
  const [results, setResults] = useState(null)
  const [sources, setSources] = useState([])
  const [unmappable, setUnmappable] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const cleanup = window.electronAPI?.kb?.onWebProgress?.((p) => {
      setProgress((prev) => ({ ...prev, [p.category]: p }))
    })
    return () => cleanup?.()
  }, [])

  async function handleAnalyse() {
    setAnalysing(true)
    setProgress({})
    setResults(null)
    setSources([])
    setUnmappable([])

    try {
      const srcProd = allProducts[sourceProduct]
      const tgtProd = allProducts[targetProduct]
      const data = await window.electronAPI.kb.analyseWeb({
        sourceProduct: srcProd?.fullName ?? sourceProduct,
        targetProduct: tgtProd?.fullName ?? targetProduct,
      })

      const rows = []
      const allSources = []
      const allUnmappable = []

      for (const cat of CATEGORIES) {
        const result = data[cat] ?? { mappings: [], sources: [], unmappable: [] }
        for (const m of result.mappings ?? []) {
          rows.push({
            id: `web_${cat}_${rows.length}`,
            source_command: m.source_command ?? '',
            target_command: m.target_command ?? '',
            category: cat,
            confidence: m.confidence ?? 'medium',
            status: m.confidence === 'high' ? 'approved' : 'needs_review',
            notes: m.notes ?? '',
          })
        }
        allSources.push(...(result.sources ?? []))
        allUnmappable.push(...(result.unmappable ?? []).map((cmd) => ({ category: cat, command: cmd })))
      }

      setResults(rows)
      setSources([...new Set(allSources)])
      setUnmappable(allUnmappable)
    } catch (err) {
      console.error('[webAnalyser]', err)
    }
    setAnalysing(false)
  }

  async function handleSave(approvedRows) {
    setSaving(true)
    try {
      const srcProd = allProducts[sourceProduct]
      const tgtProd = allProducts[targetProduct]
      const entries = approvedRows.map((r) => ({
        source_vendor: srcProd?.vendor ?? '',
        source_product: sourceProduct,
        target_vendor: tgtProd?.vendor ?? '',
        target_product: targetProduct,
        source_command: r.source_command,
        target_command: r.target_command,
        category: r.category,
        confidence: r.confidence,
        verified_by_human: true,
        source_type: 'web_search',
        notes: r.notes || null,
      }))
      await window.electronAPI.kb.saveBatch(entries)
      setResults(null)
      onComplete?.()
    } catch (err) {
      alert(err.message)
    }
    setSaving(false)
  }

  if (results) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Review Generated Mappings</h3>
          <button className="btn-ghost text-xs" onClick={() => setResults(null)}>← Back</button>
        </div>

        {sources.length > 0 && (
          <div className="text-xs text-text-muted">
            <span className="font-medium text-text-secondary">Referenced: </span>
            {sources.slice(0, 5).join(', ')}
          </div>
        )}

        <ValidationTable rows={results} onChange={setResults} onSave={handleSave} saving={saving} />

        {unmappable.length > 0 && (
          <div className="card p-3 space-y-1.5">
            <h4 className="text-xs font-semibold text-accent-yellow">Unmappable Commands ({unmappable.length})</h4>
            <div className="flex flex-wrap gap-1">
              {unmappable.slice(0, 20).map((u, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 font-mono">
                  {u.command}
                </span>
              ))}
              {unmappable.length > 20 && <span className="text-[10px] text-text-muted">+{unmappable.length - 20} more</span>}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-text-secondary">Auto-Generate from Vendor Knowledge</h3>
      <p className="text-xs text-text-muted">
        Claude analyses official CLI references for both platforms and generates command mappings per category.
      </p>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs text-text-secondary mb-1 block">Source Product</label>
          <ProductSelect groups={allGroups} allProducts={allProducts} value={sourceProduct} onChange={setSourceProduct} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-text-secondary mb-1 block">Target Product</label>
          <ProductSelect groups={allGroups} allProducts={allProducts} value={targetProduct} onChange={setTargetProduct} />
        </div>
      </div>

      {/* Progress */}
      {analysing && (
        <div className="space-y-1">
          {CATEGORIES.map((cat) => {
            const p = progress[cat]
            return (
              <div key={cat} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-text-muted capitalize">{cat}</span>
                <div className="flex-1 h-1.5 bg-surface-4 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    p?.status === 'done' ? 'bg-accent-green w-full' :
                    p?.status === 'processing' ? 'bg-accent-blue w-1/2 animate-pulse' :
                    p?.status === 'error' ? 'bg-accent-red w-full' : 'bg-surface-5 w-0'
                  }`} />
                </div>
                <span className="text-text-muted w-12 text-right">
                  {p?.status === 'done' ? `${p.count}` : p?.status === 'processing' ? '…' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <button className="btn-primary w-full" disabled={analysing} onClick={handleAnalyse}>
        {analysing ? 'Generating mappings…' : 'Search & Analyse'}
      </button>
    </div>
  )
}

function ProductSelect({ groups, allProducts, value, onChange }) {
  return (
    <select className="input text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) => {
        const prods = g.products.map((id) => typeof id === 'string' ? allProducts[id] : id).filter(Boolean)
        if (!prods.length) return null
        return <optgroup key={g.id} label={g.name}>{prods.map((p) => <option key={p.id} value={p.id}>{p.fullName ?? p.name}</option>)}</optgroup>
      })}
    </select>
  )
}
