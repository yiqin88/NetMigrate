import { useState, useRef, useCallback } from 'react'

export default function ConfigInput({ vendorPair, onConfirm, onBack }) {
  const [config, setConfig] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [fileError, setFileError] = useState('')
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const charCount = config.length
  const lineCount = config ? config.split('\n').length : 0
  const canContinue = config.trim().length > 0

  // ── File reading ────────────────────────────────────────────────────────────

  function readFile(file) {
    setFileError('')
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File too large (max 5 MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => setConfig(e.target.result)
    reader.onerror = () => setFileError('Failed to read file')
    reader.readAsText(file)
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) readFile(file)
    e.target.value = '' // reset so same file can be re-selected
  }

  // ── Drag and drop ──────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    // Only clear if leaving the drop zone entirely (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) readFile(file)
  }, [])

  // ── Paste handler (auto-detect config on paste) ────────────────────────────

  function handlePaste(e) {
    // Let the textarea handle it; just clear any prior file error
    setFileError('')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-slide-in">
      {/* Header info */}
      <div className="flex items-center gap-3 text-sm">
        <VendorChip vendor={vendorPair.source} color="yellow" />
        <ArrowRight />
        <VendorChip vendor={vendorPair.target} color="green" />
        <span className="text-text-muted ml-auto">
          Paste your {vendorPair.source.fullName} backup config below
        </span>
      </div>

      {/* Drop zone */}
      <div
        className={`relative rounded-xl border-2 transition-all duration-150
          ${isDragging
            ? 'border-accent-blue bg-accent-blue/5'
            : 'border-border hover:border-surface-5'
          }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-xl pointer-events-none">
            <UploadIcon className="text-accent-blue w-10 h-10 mb-2" />
            <span className="text-accent-blue font-medium">Drop config file here</span>
          </div>
        )}

        <textarea
          ref={textareaRef}
          className={`w-full h-96 bg-transparent rounded-xl p-4 font-mono text-xs
            text-text-primary placeholder:text-text-muted resize-none
            focus:outline-none selectable leading-relaxed
            ${isDragging ? 'opacity-20 pointer-events-none' : ''}`}
          placeholder={`Paste ${vendorPair.source.fullName} configuration here…\n\nExample:\n!\nversion 16.9\n!\nvlan 10\n name Management\n!\ninterface GigabitEthernet1/0/1\n description Uplink\n switchport mode trunk\n!\nrouter ospf 1\n network 10.0.0.0 0.0.0.255 area 0\n!`}
          value={config}
          onChange={(e) => { setConfig(e.target.value); setFileError('') }}
          onPaste={handlePaste}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      {/* Bottom bar */}
      <div className="flex items-center gap-3">
        {/* Upload button */}
        <button
          type="button"
          className="btn-secondary gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="w-4 h-4" />
          Upload file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.cfg,.conf,.log,text/plain"
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-text-muted ml-1">
          {charCount > 0 && (
            <>
              <span>{charCount.toLocaleString()} chars</span>
              <span>·</span>
              <span>{lineCount.toLocaleString()} lines</span>
            </>
          )}
          {fileError && (
            <span className="text-accent-red">{fileError}</span>
          )}
        </div>

        <div className="flex-1" />

        {/* Clear */}
        {config && (
          <button
            type="button"
            className="btn-ghost text-text-muted hover:text-accent-red"
            onClick={() => { setConfig(''); setFileError('') }}
          >
            Clear
          </button>
        )}

        {/* Back */}
        <button type="button" className="btn-secondary" onClick={onBack}>
          ← Back
        </button>

        {/* Continue */}
        <button
          type="button"
          className="btn-primary"
          disabled={!canContinue}
          onClick={() => onConfirm(config)}
        >
          Preview Config →
        </button>
      </div>
    </div>
  )
}

function VendorChip({ vendor, color }) {
  const colorMap = {
    yellow: 'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30',
    green: 'bg-accent-green/15 text-accent-green border-accent-green/30',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colorMap[color]}`}>
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: vendor.color }}
      />
      {vendor.fullName}
    </span>
  )
}

function ArrowRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-text-muted flex-shrink-0"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function UploadIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}
