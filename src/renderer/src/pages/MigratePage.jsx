import { useState, useEffect, useRef } from 'react'
import VendorSelector from '../components/VendorSelector/VendorSelector'
import ConfigInput from '../components/ConfigInput/ConfigInput'
import ConfigPreview from '../components/ConfigPreview/ConfigPreview'
import DiffView from '../components/DiffView/DiffView'
import WarningsPanel from '../components/WarningsPanel/WarningsPanel'
import SavePanel from '../components/SavePanel/SavePanel'
import { useConversion } from '../hooks/useConversion'

const STEPS = ['vendor', 'input', 'preview', 'diff', 'complete']
const STEP_LABELS = {
  vendor: 'Vendor',
  input: 'Config',
  preview: 'Preview',
  diff: 'Convert',
  complete: 'Save',
}

export default function MigratePage() {
  // ── Wizard state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState('vendor')
  const [vendorPair, setVendorPair] = useState({ source: null, target: null })
  const [sourceConfig, setSourceConfig] = useState('')
  const [convertedConfig, setConvertedConfig] = useState('')
  const [conversionResult, setConversionResult] = useState(null)
  const [corrections, setCorrections] = useState(0)
  const [convertTrigger, setConvertTrigger] = useState(0) // increment to trigger conversion

  // Ref to original converted text — used to detect manual edits
  const originalConvertedRef = useRef('')

  const {
    status: convStatus, error: convError, progressMessage, elapsed,
    convert, reset: resetConv,
  } = useConversion()

  // ── Auto-trigger conversion when convertTrigger changes ────────────────────
  useEffect(() => {
    if (convertTrigger === 0) return // initial render, skip
    if (step !== 'diff' || !sourceConfig || !vendorPair.source) return

    console.log('[MigratePage] Triggering conversion #' + convertTrigger)
    convert({ sourceConfig, sourceVendor: vendorPair.source, targetVendor: vendorPair.target })
      .then((result) => {
        setConvertedConfig(result.config)
        setConversionResult(result)
        originalConvertedRef.current = result.config
      })
      .catch(() => {}) // error already in convStatus
  }, [convertTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Track corrections when user edits converted config ────────────────────
  function handleConvertedChange(newValue) {
    setConvertedConfig(newValue)
    const changed = newValue !== originalConvertedRef.current
    setCorrections(changed ? 1 : 0)
  }

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function goTo(s) { setStep(s) }

  function handleVendorConfirm(pair) {
    setVendorPair(pair)
    goTo('input')
  }

  function handleConfigConfirm(text) {
    setSourceConfig(text)
    goTo('preview')
  }

  function handlePreviewConfirm() {
    resetConv()
    setConvertedConfig('')
    setConversionResult(null)
    setCorrections(0)
    originalConvertedRef.current = ''
    setStep('diff')
    // Trigger conversion in next tick after state is updated
    setConvertTrigger((t) => t + 1)
  }

  function handleReset() {
    setStep('vendor')
    setVendorPair({ source: null, target: null })
    setSourceConfig('')
    setConvertedConfig('')
    setConversionResult(null)
    setCorrections(0)
    setConvertTrigger(0)
    originalConvertedRef.current = ''
    resetConv()
  }

  return (
    <div className="h-full flex flex-col p-6 gap-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Config Migration</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Convert network device configurations between vendors
          </p>
        </div>
        {step !== 'vendor' && (
          <button className="btn-ghost text-xs" onClick={handleReset}>
            ✕ Start over
          </button>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} steps={STEPS} labels={STEP_LABELS} />

      {/* Step content — scrollable */}
      <div className="flex-1 overflow-auto pb-2">
        {step === 'vendor' && (
          <VendorSelector onConfirm={handleVendorConfirm} />
        )}

        {step === 'input' && (
          <ConfigInput
            vendorPair={vendorPair}
            onConfirm={handleConfigConfirm}
            onBack={() => goTo('vendor')}
          />
        )}

        {step === 'preview' && (
          <ConfigPreview
            sourceConfig={sourceConfig}
            vendorPair={vendorPair}
            onConfirm={handlePreviewConfirm}
            onBack={() => goTo('input')}
          />
        )}

        {step === 'diff' && (
          <ConvertStep
            sourceConfig={sourceConfig}
            convertedConfig={convertedConfig}
            conversionResult={conversionResult}
            convStatus={convStatus}
            convError={convError}
            progressMessage={progressMessage}
            elapsed={elapsed}
            vendorPair={vendorPair}
            corrections={corrections}
            onConvertedChange={handleConvertedChange}
            onRetry={handlePreviewConfirm}
            onBack={() => goTo('preview')}
            onContinue={() => goTo('complete')}
          />
        )}

        {step === 'complete' && (
          <SavePanel
            vendorPair={vendorPair}
            sourceConfig={sourceConfig}
            convertedConfig={convertedConfig}
            conversionResult={conversionResult}
            corrections={corrections}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}

// ── Convert step (loading / error / success) ───────────────────────────────

function ConvertStep({
  sourceConfig, convertedConfig, conversionResult,
  convStatus, convError, progressMessage, elapsed, vendorPair, corrections,
  onConvertedChange, onRetry, onBack, onContinue,
}) {
  if (convStatus === 'idle' || convStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-80 gap-5 animate-fade-in">
        <SpinnerIcon />
        <div className="text-center space-y-2">
          <p className="text-sm font-medium text-text-primary">Converting with Claude…</p>
          <p className="text-xs text-accent-blue animate-fade-in" key={progressMessage}>
            {progressMessage || 'Preparing conversion…'}
          </p>
          {elapsed > 0 && (
            <p className="text-xs text-text-muted">
              {elapsed}s elapsed
              {elapsed >= 45 && ' — almost there…'}
            </p>
          )}
        </div>
        <button className="btn-ghost text-xs mt-2" onClick={onBack}>
          Cancel
        </button>
      </div>
    )
  }

  if (convStatus === 'error') {
    return (
      <div className="max-w-xl mx-auto mt-8 card p-6 space-y-4 text-center animate-fade-in">
        <div className="text-3xl">⚠️</div>
        <div>
          <p className="text-sm font-semibold text-accent-red">Conversion Failed</p>
          <p className="text-xs text-text-secondary mt-1 selectable">{convError}</p>
        </div>
        <div className="flex justify-center gap-3">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <button className="btn-primary" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  // success
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Conversion summary chips */}
      {conversionResult?.summary && (
        <SummaryBar summary={conversionResult.summary} vendorPair={vendorPair} />
      )}

      {/* Diff / edit view */}
      <DiffView
        sourceConfig={sourceConfig}
        convertedConfig={convertedConfig}
        onChange={onConvertedChange}
        vendorPair={vendorPair}
      />

      {/* Warnings */}
      <WarningsPanel warnings={conversionResult?.warnings ?? []} />

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-1">
        <button className="btn-secondary" onClick={onBack}>
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {corrections > 0 && (
            <span className="text-xs text-accent-yellow">
              {corrections} correction{corrections !== 1 ? 's' : ''} made
            </span>
          )}
          <button className="btn-primary px-6" onClick={onContinue}>
            Save Migration →
          </button>
        </div>
      </div>
    </div>
  )
}

function SummaryBar({ summary, vendorPair }) {
  const items = [
    summary.vlans > 0 && `${summary.vlans} VLANs`,
    summary.interfaces > 0 && `${summary.interfaces} interfaces`,
    summary.portChannels > 0 && `${summary.portChannels} port-channels`,
    ...(summary.routingProtocols ?? []).map((p) => p),
  ].filter(Boolean)

  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-text-muted">Converted:</span>
      {items.map((item) => (
        <span key={item} className="text-xs px-2 py-0.5 rounded bg-accent-green/15 text-accent-green border border-accent-green/25">
          {item}
        </span>
      ))}
      <span className="text-xs text-text-muted ml-1">
        → {vendorPair?.target?.shortName} syntax
      </span>
    </div>
  )
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current, steps, labels }) {
  const currentIdx = steps.indexOf(current)

  return (
    <div className="flex items-center gap-0 flex-shrink-0">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                ${i < currentIdx
                  ? 'bg-accent-green text-white'
                  : i === currentIdx
                    ? 'bg-accent-blue text-white'
                    : 'bg-surface-4 text-text-muted'
                }`}
            >
              {i < currentIdx ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium transition-colors hidden sm:inline
              ${i === currentIdx ? 'text-text-primary' : 'text-text-muted'}`}>
              {labels[step]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 mx-2 transition-colors
              ${i < currentIdx ? 'bg-accent-green' : 'bg-border'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function SpinnerIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
      stroke="#388bfd" strokeWidth="2.5" strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}
