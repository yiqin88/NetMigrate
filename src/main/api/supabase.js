// Main-process Supabase service — all DB calls go through here
// Avoids CSP/CORS issues in the Electron renderer process

import { createClient } from '@supabase/supabase-js'
import { getSetting } from '../settings'

let _client = null

function resolveCredentials() {
  // 1. Check env vars injected by electron-vite at build time
  const envUrl = process.env.VITE_SUPABASE_URL
  const envKey = process.env.VITE_SUPABASE_ANON_KEY
  if (envUrl && envKey) return { url: envUrl, key: envKey }

  // 2. Fall back to values saved by user in Settings (electron-store via safeStore)
  const url = getSetting('__safe_supabase_url')
  const key = getSetting('__safe_supabase_anon_key')
  return { url, key }
}

function getClient() {
  if (_client) return _client

  const { url, key } = resolveCredentials()
  if (!url || !key) {
    console.warn('[supabase] Not configured')
    return null
  }

  console.log('[supabase] Creating client for:', url)
  _client = createClient(url, key)
  return _client
}

export function resetClient() {
  _client = null
}

export async function getRecentMigrations({ sourceVendor, targetVendor, limit = 10 }) {
  const client = getClient()
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

export async function saveMigration(record) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured. Go to Settings to add credentials.')

  const { data, error } = await client
    .from('migrations')
    .insert(record)
    .select()
    .single()

  if (error) throw new Error(`Supabase save failed: ${error.message}`)
  return data
}

export async function getMigrationStats() {
  const client = getClient()
  if (!client) return []

  const { data, error } = await client
    .from('migrations')
    .select('id, source_vendor, target_vendor, accuracy_rating, corrections_made, created_at')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[supabase] getMigrationStats:', error.message)
    return []
  }
  return data ?? []
}

export async function testConnection() {
  try {
    const client = getClient()
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
