import { createClient } from '@supabase/supabase-js'

let _client = null

async function resolveCredentials() {
  // 1. Prefer build-time env vars (set via .env in dev, or baked in at build time)
  const envUrl = import.meta.env.VITE_SUPABASE_URL
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (envUrl && envKey) return { url: envUrl, key: envKey }

  // 2. Fall back to values saved by the user in Settings → safeStorage
  const url = await window.electronAPI?.settings.get('supabase_url')
  const key = await window.electronAPI?.settings.get('supabase_anon_key')
  return { url, key }
}

export async function getSupabaseClient() {
  if (_client) return _client

  const { url, key } = await resolveCredentials()
  if (!url || !key) {
    console.warn('[supabase] Not configured — go to Settings to add credentials.')
    return null
  }

  _client = createClient(url, key)
  return _client
}

// Call this after the user saves new credentials in Settings to refresh the client
export function resetSupabaseClient() {
  _client = null
}

// ── Migrations ────────────────────────────────────────────────────────────────

export async function saveMigration(migration) {
  const client = await getSupabaseClient()
  if (!client) throw new Error('Supabase not configured. Go to Settings to add credentials.')

  const { data, error } = await client
    .from('migrations')
    .insert(migration)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getRecentMigrations({ sourceVendor, targetVendor, limit = 10 }) {
  const client = await getSupabaseClient()
  if (!client) return []

  const { data, error } = await client
    .from('migrations')
    .select('id, source_config, converted_config, accuracy_rating, created_at')
    .eq('source_vendor', sourceVendor)
    .eq('target_vendor', targetVendor)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[supabase] getRecentMigrations:', error.message)
    return []
  }
  return data ?? []
}

export async function getMigrationStats() {
  const client = await getSupabaseClient()
  if (!client) return null

  const { data, error } = await client
    .from('migrations')
    .select('id, source_vendor, target_vendor, accuracy_rating, corrections_made, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[supabase] getMigrationStats:', error.message)
    return null
  }
  return data ?? []
}

export async function testConnection() {
  try {
    const client = await getSupabaseClient()
    if (!client) return { ok: false, error: 'Not configured' }

    const { error } = await client
      .from('migrations')
      .select('id')
      .limit(1)

    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}
