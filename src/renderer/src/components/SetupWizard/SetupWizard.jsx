import { useState, useEffect, useCallback } from 'react'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export default function SetupWizard({ onComplete }) {
  const [step, setStep] = useState(1)

  // Step 2 — invite code
  const [inviteCode, setInviteCode] = useState('')
  const [inviteStatus, setInviteStatus] = useState(null) // null|'checking'|'valid'|'invalid'
  const [inviteError, setInviteError] = useState('')
  const [orgName, setOrgName] = useState('')

  // Step 3 — API key
  const [apiKey, setApiKey] = useState('')
  const [apiKeyStatus, setApiKeyStatus] = useState(null) // null|'testing'|'valid'|'invalid'
  const [apiKeyError, setApiKeyError] = useState('')

  // Step 4 — connection tests
  const [supabaseTest, setSupabaseTest] = useState(null) // null|'testing'|'pass'|'fail'
  const [claudeTest, setClaudeTest] = useState(null)
  const [supabaseTestError, setSupabaseTestError] = useState('')
  const [claudeTestError, setClaudeTestError] = useState('')

  // Step 5 — stats
  const [kbCount, setKbCount] = useState(0)
  const [trainingCount, setTrainingCount] = useState(0)
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Step 2 handler ──────────────────────────────────────────────────────────

  async function handleValidateInvite() {
    if (!inviteCode.trim()) return
    setInviteStatus('checking')
    setInviteError('')
    try {
      const result = await window.electronAPI?.setup?.validateInvite(inviteCode)
      if (result?.valid) {
        setInviteStatus('valid')
        setOrgName(result.orgName)
        // Store build-time Supabase credentials as user's own
        await window.electronAPI?.safeStore?.set('supabase_url', SUPABASE_URL)
        await window.electronAPI?.safeStore?.set('supabase_anon_key', SUPABASE_KEY)
        await window.electronAPI?.supabase?.reset()
      } else {
        setInviteStatus('invalid')
        setInviteError(result?.error ?? 'Invalid invite code')
      }
    } catch (err) {
      setInviteStatus('invalid')
      setInviteError(err.message ?? 'Validation failed')
    }
  }

  // ── Step 3 handler ──────────────────────────────────────────────────────────

  async function handleValidateKey() {
    if (!apiKey.trim()) return
    setApiKeyStatus('testing')
    setApiKeyError('')
    try {
      const result = await window.electronAPI?.claude?.testKey(apiKey)
      if (result?.valid) {
        setApiKeyStatus('valid')
        await window.electronAPI?.safeStore?.set('anthropic_api_key', apiKey)
      } else {
        setApiKeyStatus('invalid')
        setApiKeyError(result?.error ?? 'Invalid API key')
      }
    } catch (err) {
      setApiKeyStatus('invalid')
      setApiKeyError(err.message ?? 'Test failed')
    }
  }

  // ── Step 4 auto-test ────────────────────────────────────────────────────────

  const runTests = useCallback(async () => {
    setSupabaseTest('testing')
    setClaudeTest('testing')
    setSupabaseTestError('')
    setClaudeTestError('')

    try {
      const sbResult = await window.electronAPI?.supabase?.testConnection()
      if (sbResult?.ok) {
        setSupabaseTest('pass')
      } else {
        setSupabaseTest('fail')
        setSupabaseTestError(sbResult?.error ?? 'Connection failed')
      }
    } catch (err) {
      setSupabaseTest('fail')
      setSupabaseTestError(err.message)
    }

    try {
      const clResult = await window.electronAPI?.claude?.testKey(apiKey)
      if (clResult?.valid) {
        setClaudeTest('pass')
      } else {
        setClaudeTest('fail')
        setClaudeTestError(clResult?.error ?? 'Key invalid')
      }
    } catch (err) {
      setClaudeTest('fail')
      setClaudeTestError(err.message)
    }
  }, [apiKey])

  useEffect(() => {
    if (step === 4) runTests()
  }, [step, runTests])

  // ── Step 5 load stats ───────────────────────────────────────────────────────

  useEffect(() => {
    if (step !== 5) return
    setStatsLoading(true)
    async function load() {
      try {
        const kbStats = await window.electronAPI?.kb?.stats()
        setKbCount(kbStats?.total ?? 0)

        const counts = await window.electronAPI?.training?.counts()
        const total = Array.isArray(counts)
          ? counts.reduce((sum, c) => sum + c.count, 0)
          : 0
        setTrainingCount(total)
      } catch { /* ignore */ }
      setStatsLoading(false)
    }
    load()
  }, [step])

  // ── Finish ──────────────────────────────────────────────────────────────────

  async function handleFinish() {
    await window.electronAPI?.settings?.set('setup_complete', true)
    onComplete()
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const bothTestsPass = supabaseTest === 'pass' && claudeTest === 'pass'

  return (
    <div className="fixed inset-0 bg-surface flex flex-col items-center justify-center z-50">
      {/* Drag region for title bar */}
      <div className="absolute top-0 left-0 right-0 h-11" style={{ WebkitAppRegion: 'drag' }} />

      {/* Step dots */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full transition-colors ${
              s === step ? 'bg-accent-blue' : s < step ? 'bg-accent-green' : 'bg-surface-4'
            }`}
          />
        ))}
      </div>

      {/* Card */}
      <div className="card w-full max-w-lg p-8 space-y-6 animate-fade-in" key={step}>

        {/* ── Step 1: Welcome ─────────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <div className="text-center space-y-3">
              <div className="text-4xl mb-2">
                <NetMigrateIcon />
              </div>
              <h1 className="text-xl font-semibold text-text-primary">Welcome to NetMigrate</h1>
              <p className="text-sm text-text-secondary leading-relaxed">
                Migrate network configurations between vendors with AI-powered conversion.
                Let's get you set up in a few quick steps.
              </p>
            </div>
            <button className="btn-primary w-full" onClick={() => setStep(2)}>
              Get Started
            </button>
          </>
        )}

        {/* ── Step 2: Invite Code ─────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Organisation Invite Code</h2>
              <p className="text-sm text-text-secondary mt-1">
                Enter the invite code provided by your organisation admin.
              </p>
            </div>
            <div>
              <input
                type="text"
                className="input font-mono"
                placeholder="e.g. NETMIG-2024-ALPHA"
                value={inviteCode}
                onChange={(e) => { setInviteCode(e.target.value); setInviteStatus(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateInvite()}
              />
            </div>

            {inviteStatus === 'valid' && (
              <div className="badge-success w-fit animate-fade-in">
                Organisation: {orgName}
              </div>
            )}
            {inviteStatus === 'invalid' && (
              <div className="badge-critical w-fit animate-fade-in">
                {inviteError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setStep(1)}>Back</button>
              {inviteStatus === 'valid' ? (
                <button className="btn-primary" onClick={() => setStep(3)}>
                  Next
                </button>
              ) : (
                <button
                  className="btn-primary"
                  disabled={!inviteCode.trim() || inviteStatus === 'checking'}
                  onClick={handleValidateInvite}
                >
                  {inviteStatus === 'checking' ? (
                    <span className="animate-pulse-subtle">Validating...</span>
                  ) : (
                    'Validate'
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Step 3: API Key ─────────────────────────────────────────────── */}
        {step === 3 && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Anthropic API Key</h2>
              <p className="text-sm text-text-secondary mt-1">
                Enter your personal Claude API key. This is stored securely on your device.
              </p>
            </div>
            <div>
              <input
                type="password"
                className="input font-mono"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setApiKeyStatus(null) }}
                onKeyDown={(e) => e.key === 'Enter' && handleValidateKey()}
              />
            </div>

            {apiKeyStatus === 'valid' && (
              <div className="badge-success w-fit animate-fade-in">
                API key valid
              </div>
            )}
            {apiKeyStatus === 'invalid' && (
              <div className="badge-critical w-fit animate-fade-in">
                {apiKeyError}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setStep(2)}>Back</button>
              {apiKeyStatus === 'valid' ? (
                <button className="btn-primary" onClick={() => setStep(4)}>
                  Next
                </button>
              ) : (
                <button
                  className="btn-primary"
                  disabled={!apiKey.trim() || apiKeyStatus === 'testing'}
                  onClick={handleValidateKey}
                >
                  {apiKeyStatus === 'testing' ? (
                    <span className="animate-pulse-subtle">Testing...</span>
                  ) : (
                    'Validate'
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {/* ── Step 4: Test Connections ─────────────────────────────────────── */}
        {step === 4 && (
          <>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Testing Connections</h2>
              <p className="text-sm text-text-secondary mt-1">
                Verifying your credentials work correctly.
              </p>
            </div>

            <div className="space-y-3">
              <TestRow label="Supabase Database" status={supabaseTest} error={supabaseTestError} />
              <TestRow label="Claude API" status={claudeTest} error={claudeTestError} />
            </div>

            <div className="flex gap-3 justify-end">
              <button className="btn-ghost" onClick={() => setStep(3)}>Back</button>
              {!bothTestsPass && (supabaseTest === 'fail' || claudeTest === 'fail') && (
                <button className="btn-secondary" onClick={runTests}>
                  Retry
                </button>
              )}
              <button
                className="btn-primary"
                disabled={!bothTestsPass}
                onClick={() => setStep(5)}
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* ── Step 5: Success ─────────────────────────────────────────────── */}
        {step === 5 && (
          <>
            <div className="text-center space-y-3">
              <div className="text-4xl">&#127881;</div>
              <h2 className="text-xl font-semibold text-text-primary">You're All Set!</h2>
              <p className="text-sm text-text-secondary">
                Welcome to <span className="text-text-primary font-medium">{orgName}</span>
              </p>
            </div>

            {statsLoading ? (
              <p className="text-center text-sm text-text-muted animate-pulse-subtle">
                Loading knowledge base...
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="KB Mappings" value={kbCount} />
                <StatCard label="Training Pairs" value={trainingCount} />
              </div>
            )}

            <button
              className="btn-primary w-full"
              disabled={statsLoading}
              onClick={handleFinish}
            >
              Start Using NetMigrate
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TestRow({ label, status, error }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-surface-2">
      <span className="text-sm text-text-primary">{label}</span>
      <div className="text-sm">
        {status === 'testing' && (
          <span className="text-accent-blue animate-pulse-subtle">Testing...</span>
        )}
        {status === 'pass' && (
          <span className="text-accent-green">Connected</span>
        )}
        {status === 'fail' && (
          <span className="text-accent-red" title={error}>Failed</span>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="text-center p-4 rounded-lg bg-surface-2">
      <div className="text-2xl font-bold text-text-primary">{value.toLocaleString()}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  )
}

function NetMigrateIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className="text-accent-blue mx-auto"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
      <rect x="1" y="4" width="6" height="16" rx="1" opacity="0.3" />
      <rect x="17" y="4" width="6" height="16" rx="1" opacity="0.3" />
    </svg>
  )
}
