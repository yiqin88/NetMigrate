import { useState, useRef, useEffect, useMemo } from 'react'
import { useVendors } from '../../hooks/useVendors'
import { getCategoriesForPair, isCrossDeviceType, DEVICE_TYPES } from '../../constants/vendors'
import ValidationTable from './ValidationTable'

export default function DocAnalyser({ onComplete }) {
  const { allProducts, allGroups } = useVendors()
  const allList = Object.values(allProducts)
  const [sourceProduct, setSourceProduct] = useState(allList[0]?.id ?? '')
  const [targetProduct, setTargetProduct] = useState(allList[1]?.id ?? allList[0]?.id ?? '')
  const [sourceDoc, setSourceDoc] = useState('')
  const [targetDoc, setTargetDoc] = useState('')
  const [sourceFile, setSourceFile] = useState('')
  const [targetFile, setTargetFile] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [progress, setProgress] = useState({}) // { category: { status, count? } }
  const [results, setResults] = useState(null) // validation rows
  const [saving, setSaving] = useState(false)
  const srcRef = useRef(null)
  const tgtRef = useRef(null)

  // Dynamic categories based on device types
  const srcType = allProducts[sourceProduct]?.deviceType ?? 'switch'
  const tgtType = allProducts[targetProduct]?.deviceType ?? 'switch'
  const categories = useMemo(() => getCategoriesForPair(srcType, tgtType), [srcType, tgtType])
  const crossType = isCrossDeviceType(srcType, tgtType)

  // Listen for progress events
  useEffect(() => {
    const cleanup = window.electronAPI?.kb?.onDocsProgress?.((p) => {
      setProgress((prev) => ({ ...prev, [p.category]: p }))
    })
    return () => cleanup?.()
  }, [])

  function readFile(file, setDoc, setName) {
    setName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => setDoc(e.target.result)
    reader.readAsText(file)
  }

  async function handleAnalyse() {
    if (!sourceDoc.trim() || !targetDoc.trim()) return
    setAnalysing(true)
    setProgress({})
    setResults(null)

    try {
      const srcProd = allProducts[sourceProduct]
      const tgtProd = allProducts[targetProduct]
      const data = await window.electronAPI.kb.analyseDocs({
        sourceDoc: sourceDoc,
        targetDoc: targetDoc,
        sourceProduct: srcProd?.fullName ?? sourceProduct,
        targetProduct: tgtProd?.fullName ?? targetProduct,
        categories,
      })

      // Flatten results into validation rows
      const rows = []
      for (const cat of categories) {
        const mappings = data[cat] ?? []
        for (const m of mappings) {
          rows.push({
            id: `doc_${cat}_${rows.length}`,
            source_command: m.source_command ?? '',
            target_command: m.target_command ?? '',
            category: cat,
            confidence: m.confidence ?? 'medium',
            status: m.confidence === 'high' ? 'approved' : m.confidence === 'low' ? 'needs_review' : 'needs_review',
            notes: m.notes ?? '',
          })
        }
      }
      setResults(rows)
    } catch (err) {
      console.error('[docAnalyser]', err)
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
        source_type: 'doc_upload',
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
          <h3 className="text-sm font-semibold text-text-primary">Review Extracted Mappings</h3>
          <button className="btn-ghost text-xs" onClick={() => setResults(null)}>← Back to upload</button>
        </div>
        <ValidationTable rows={results} onChange={setResults} onSave={handleSave} saving={saving} categories={categories} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-text-secondary">Upload Vendor Documentation</h3>

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

      {/* Device type info + cross-type warning */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] text-text-muted">Categories ({categories.length}):</span>
        {categories.map((c) => (
          <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-4 text-text-secondary">{c}</span>
        ))}
      </div>
      {crossType && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-accent-yellow/10 border border-accent-yellow/25 text-xs text-accent-yellow">
          ⚠️ Cross device type: {DEVICE_TYPES[srcType]?.label} → {DEVICE_TYPES[tgtType]?.label}. Using combined categories.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <UploadArea label="Source Docs" fileName={sourceFile} hasContent={!!sourceDoc}
          onFile={(f) => readFile(f, setSourceDoc, setSourceFile)} fileRef={srcRef}
          onPaste={(t) => { setSourceDoc(t); setSourceFile('pasted') }} />
        <UploadArea label="Target Docs" fileName={targetFile} hasContent={!!targetDoc}
          onFile={(f) => readFile(f, setTargetDoc, setTargetFile)} fileRef={tgtRef}
          onPaste={(t) => { setTargetDoc(t); setTargetFile('pasted') }} />
      </div>

      {/* Progress */}
      {analysing && (
        <div className="space-y-1">
          {categories.map((cat) => {
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
                  {p?.status === 'done' ? `${p.count}` : p?.status === 'processing' ? '…' : p?.status === 'error' ? 'err' : ''}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <button className="btn-primary w-full" disabled={!sourceDoc.trim() || !targetDoc.trim() || analysing}
        onClick={handleAnalyse}>
        {analysing ? 'Analysing categories…' : 'Analyse Documents'}
      </button>
    </div>
  )
}

function UploadArea({ label, fileName, hasContent, onFile, fileRef, onPaste }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-text-secondary">{label}</span>
        {fileName && <span className="text-[10px] text-accent-green">{fileName}</span>}
      </div>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center text-xs cursor-pointer transition-colors
          ${dragOver ? 'border-accent-blue bg-accent-blue/5' : hasContent ? 'border-accent-green/40 bg-accent-green/5' : 'border-border hover:border-surface-5'}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); e.dataTransfer.files?.[0] && onFile(e.dataTransfer.files[0]) }}
      >
        {hasContent ? (
          <span className="text-accent-green">Document loaded</span>
        ) : (
          <span className="text-text-muted">Drop PDF/TXT here or click to upload</span>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".pdf,.txt,.cfg,.conf" className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  )
}

function ProductSelect({ groups, allProducts, value, onChange }) {
  return (
    <select className="input text-xs" value={value} onChange={(e) => onChange(e.target.value)}>
      {groups.map((g) => {
        const prods = g.products.map((id) => typeof id === 'string' ? allProducts[id] : id).filter(Boolean)
        if (!prods.length) return null
        return <optgroup key={g.id} label={g.name}>{prods.map((p) => <option key={p.id} value={p.id}>{DEVICE_TYPES[p.deviceType]?.icon ?? ''} {p.fullName ?? p.name}</option>)}</optgroup>
      })}
    </select>
  )
}
