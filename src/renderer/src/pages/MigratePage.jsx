import { useState } from 'react'
import VendorSelector from '../components/VendorSelector/VendorSelector'

const STEPS = ['vendor', 'input', 'preview', 'diff', 'complete']

export default function MigratePage() {
  const [step, setStep] = useState('vendor')
  const [vendorPair, setVendorPair] = useState({ source: null, target: null })

  function handleVendorConfirm(pair) {
    setVendorPair(pair)
    setStep('input')
  }

  return (
    <div className="h-full flex flex-col p-6 gap-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Config Migration</h1>
        <p className="text-sm text-text-secondary mt-1">
          Convert network device configurations between vendors
        </p>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} steps={STEPS} />

      {/* Step content */}
      <div className="flex-1 overflow-auto">
        {step === 'vendor' && (
          <VendorSelector onConfirm={handleVendorConfirm} />
        )}
        {step === 'input' && (
          <Placeholder
            title="Step 2: Paste or Upload Config"
            description="ConfigInput component will go here"
            onBack={() => setStep('vendor')}
          />
        )}
        {step === 'preview' && (
          <Placeholder
            title="Step 3: Config Preview"
            description="ConfigPreview component will go here"
            onBack={() => setStep('input')}
          />
        )}
        {step === 'diff' && (
          <Placeholder
            title="Step 4: Diff View"
            description="DiffView + WarningsPanel will go here"
            onBack={() => setStep('preview')}
          />
        )}
        {step === 'complete' && (
          <Placeholder
            title="Step 5: Complete"
            description="Rating + save + export will go here"
            onBack={() => setStep('diff')}
          />
        )}
      </div>
    </div>
  )
}

function StepIndicator({ current, steps }) {
  const labels = {
    vendor: 'Vendor',
    input: 'Config',
    preview: 'Preview',
    diff: 'Convert',
    complete: 'Save',
  }
  const currentIdx = steps.indexOf(current)

  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                ${i < currentIdx
                  ? 'bg-accent-green text-white'
                  : i === currentIdx
                    ? 'bg-accent-blue text-white'
                    : 'bg-surface-4 text-text-muted'
                }`}
            >
              {i < currentIdx ? '✓' : i + 1}
            </div>
            <span
              className={`text-sm font-medium transition-colors
                ${i === currentIdx ? 'text-text-primary' : 'text-text-muted'}`}
            >
              {labels[step]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-px w-8 mx-2 transition-colors
                ${i < currentIdx ? 'bg-accent-green' : 'bg-border'}`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

function Placeholder({ title, description, onBack }) {
  return (
    <div className="card p-8 text-center max-w-xl mx-auto mt-8">
      <div className="text-4xl mb-4">🚧</div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">{title}</h2>
      <p className="text-sm text-text-secondary mb-6">{description}</p>
      <button onClick={onBack} className="btn-secondary">
        ← Back
      </button>
    </div>
  )
}
