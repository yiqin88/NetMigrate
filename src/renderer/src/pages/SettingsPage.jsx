import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const key = await window.electronAPI?.safeStore.get('anthropic_api_key')
      if (key) setApiKey(key)
      const url = await window.electronAPI?.settings.get('supabase_url')
      if (url) setSupabaseUrl(url)
      const sk = await window.electronAPI?.settings.get('supabase_anon_key')
      if (sk) setSupabaseKey(sk)
    }
    load()
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (apiKey) await window.electronAPI?.safeStore.set('anthropic_api_key', apiKey)
    if (supabaseUrl) await window.electronAPI?.settings.set('supabase_url', supabaseUrl)
    if (supabaseKey) await window.electronAPI?.settings.set('supabase_anon_key', supabaseKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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
              <AnthropicIcon />
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
                Stored securely using OS keychain. Never saved to disk in plaintext.
              </p>
            </div>
          </section>

          {/* Supabase */}
          <section className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <SupabaseIcon />
              <h2 className="text-sm font-semibold text-text-primary">Supabase</h2>
            </div>
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

          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary">
              Save Settings
            </button>
            {saved && (
              <span className="text-sm text-accent-green animate-fade-in">
                ✓ Saved successfully
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function AnthropicIcon() {
  return (
    <div className="w-6 h-6 rounded bg-[#cc785c]/20 flex items-center justify-center">
      <span className="text-xs font-bold text-[#cc785c]">A</span>
    </div>
  )
}

function SupabaseIcon() {
  return (
    <div className="w-6 h-6 rounded bg-accent-green/20 flex items-center justify-center">
      <span className="text-xs font-bold text-accent-green">S</span>
    </div>
  )
}
