import { createClient } from '@supabase/supabase-js'

let _client = null

export function getSupabaseClient() {
  if (_client) return _client

  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
    return null
  }

  _client = createClient(url, key)
  return _client
}

// ── Migrations ────────────────────────────────────────────────────────────────

export async function saveMigration(migration) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Supabase not configured')

  const { data, error } = await client
    .from('migrations')
    .insert(migration)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function getRecentMigrations({ sourceVendor, targetVendor, limit = 10 }) {
  const client = getSupabaseClient()
  if (!client) return []

  const { data, error } = await client
    .from('migrations')
    .select('*')
    .eq('source_vendor', sourceVendor)
    .eq('target_vendor', targetVendor)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[supabase] getRecentMigrations:', error)
    return []
  }
  return data
}

export async function getMigrationStats() {
  const client = getSupabaseClient()
  if (!client) return null

  const { data, error } = await client
    .from('migrations')
    .select('source_vendor, target_vendor, accuracy_rating, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[supabase] getMigrationStats:', error)
    return null
  }
  return data
}
