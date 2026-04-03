import { useState, useEffect } from 'react'
import { testConnection, resetSupabaseClient } from '../services/supabase'
import { testApiKey } from '../services/claude'
import TrainingConfigs from '../components/TrainingConfigs/TrainingConfigs'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [apiKeyStatus, setApiKeyStatus] = useState(null) // null | 'testing' | 'valid' | 'invalid'
  const [apiKeyError, setApiKeyError] = useState('')
  const [connStatus, setConnStatus] = useState(null) // null | 'testing' | 'ok' | 'error'
  const [connError, setConnError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const key = await window.electronAPI?.safeStore.get('anthropic_api_key')
        if (key) setApiKey(key)
        const url = await window.electronAPI?.safeStore.get('supabase_url')
        if (url) setSupabaseUrl(url)
        const sk = await window.electronAPI?.safeStore.get('supabase_anon_key')
        if (sk) setSupabaseKey(sk)
      } catch (err) {
        console.error('[settings] failed to load settings:', err)
      }
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')
    setApiKeyStatus(null)
    setApiKeyError('')
    try {
      if (apiKey) await window.electronAPI?.safeStore.set('anthropic_api_key', apiKey)
      await window.electronAPI?.safeStore.set('supabase_url', supabaseUrl)
      await window.electronAPI?.safeStore.set('supabase_anon_key', supabaseKey)
      resetSupabaseClient()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)

      // Auto-validate API key after saving
      if (apiKey) {
        setApiKeyStatus('testing')
        const result = await testApiKey(apiKey)
        setApiKeyStatus(result.valid ? 'valid' : 'invalid')
        if (!result.valid) setApiKeyError(result.error)
      }
    } catch (err) {
      console.error('[settings] save failed:', err)
      setSaveError(err.message ?? 'Failed to save settings')
    }
  }

  async function handleTestConnection() {
    setConnStatus('testing')
    setConnError('')
    const result = await testConnection()
    setConnStatus(result.ok ? 'ok' : 'error')
    if (!result.ok) setConnError(result.error)
  }

  return (
    <div className="h-full overflow-auto p-6 animate-fade-in">
      <div className="max-w-xl">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure API keys and preferences
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Anthropic */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <VendorBadge color="#cc785c" label="A" />
              <h2 className="text-sm font-semibold text-text-primary">Anthropic API</h2>
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">API Key</label>
              <input
                type="password"
                className="input"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-text-muted mt-1.5">
                Stored securely using encrypted local storage.
              </p>
              {/* API key validation status */}
              {apiKeyStatus === 'testing' && (
                <p className="text-xs text-accent-blue mt-2 animate-pulse-subtle">
                  Validating API key…
                </p>
              )}
              {apiKeyStatus === 'valid' && (
                <div className="badge-success w-fit mt-2 animate-fade-in">
                  API key valid ✅
                </div>
              )}
              {apiKeyStatus === 'invalid' && (
                <div className="badge-critical w-fit mt-2 animate-fade-in">
                  API key invalid ❌ {apiKeyError && `— ${apiKeyError}`}
                </div>
              )}
            </div>
          </section>

          {/* Supabase */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <VendorBadge color="#3ecf8e" label="S" />
                <h2 className="text-sm font-semibold text-text-primary">Supabase</h2>
              </div>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={handleTestConnection}
                disabled={connStatus === 'testing'}
              >
                {connStatus === 'testing' ? (
                  <span className="animate-pulse-subtle">Testing…</span>
                ) : (
                  'Test Connection'
                )}
              </button>
            </div>

            {/* Connection status */}
            {connStatus === 'ok' && (
              <div className="badge-success w-fit animate-fade-in">
                ✓ Connected to Supabase
              </div>
            )}
            {connStatus === 'error' && (
              <div className="badge-critical w-fit animate-fade-in">
                ✗ {connError || 'Connection failed'}
              </div>
            )}

            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Project URL</label>
              <input
                type="url"
                className="input"
                placeholder="https://xxxx.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-1.5">Anon Key</label>
              <input
                type="password"
                className="input"
                placeholder="eyJ..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
              />
            </div>
          </section>

          {/* Training configs — outside the save form since it has its own save flow */}
          <TrainingConfigs />

          {saveError && (
            <div className="badge-critical w-full text-sm p-3 rounded-lg animate-fade-in">
              {saveError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">
              Save Settings
            </button>
            {saved && (
              <span className="text-sm text-accent-green animate-fade-in">
                ✓ Saved
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function VendorBadge({ color, label }) {
  return (
    <div
      className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ backgroundColor: color + '25', border: `1px solid ${color}40`, color }}
    >
      {label}
    </div>
  )
}
