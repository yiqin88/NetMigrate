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

export function getClient() {
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

// Run on startup — ensure all required columns and tables exist
export async function ensureSchema() {
  const client = getClient()
  if (!client) return

  // Check command_mappings column
  try {
    const { error } = await client.from('training_examples').select('command_mappings').limit(1)
    if (error && error.message.includes('command_mappings')) {
      console.warn('[supabase] command_mappings column missing — run sql/create_device_types_table.sql')
    }
  } catch { /* ignore */ }

  // Check device_type column on custom_products
  try {
    const { error } = await client.from('custom_products').select('device_type').limit(1)
    if (error && error.message.includes('device_type')) {
      console.warn('[supabase] device_type column missing on custom_products — run sql/create_device_types_table.sql')
    } else {
      console.log('[supabase] Schema OK — device_type column exists')
    }
  } catch { /* ignore */ }

  // Check device_types table exists
  try {
    const { error } = await client.from('device_types').select('name').limit(1)
    if (error) {
      console.warn('[supabase] device_types table missing — run sql/create_device_types_table.sql')
    } else {
      console.log('[supabase] Schema OK — device_types table exists')
    }
  } catch { /* ignore */ }
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

// ── Training examples ─────────────────────────────────────────────────────────

export async function listTrainingExamples({ sourceVendor, targetVendor } = {}) {
  const client = getClient()
  if (!client) return []

  // Try with command_mappings first, fall back without it if column doesn't exist
  let columns = 'id, source_vendor, target_vendor, description, command_mappings, created_at'
  let query = client.from('training_examples').select(columns).order('created_at', { ascending: false })
  if (sourceVendor) query = query.eq('source_vendor', sourceVendor)
  if (targetVendor) query = query.eq('target_vendor', targetVendor)

  let { data, error } = await query
  if (error && error.message.includes('command_mappings')) {
    // Column doesn't exist yet — query without it
    columns = 'id, source_vendor, target_vendor, description, created_at'
    query = client.from('training_examples').select(columns).order('created_at', { ascending: false })
    if (sourceVendor) query = query.eq('source_vendor', sourceVendor)
    if (targetVendor) query = query.eq('target_vendor', targetVendor)
    const result = await query
    data = result.data
    error = result.error
  }

  if (error) { console.error('[supabase] listTrainingExamples:', error.message); return [] }
  return data ?? []
}

export async function saveTrainingExample(record) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')

  const { data, error } = await client
    .from('training_examples')
    .insert(record)
    .select()
    .single()

  if (error) throw new Error(`Save failed: ${error.message}`)
  return data
}

export async function deleteTrainingExample(id) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')

  const { error } = await client
    .from('training_examples')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Delete failed: ${error.message}`)
}

export async function updateTrainingExample(id, updates) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')

  const { data, error } = await client
    .from('training_examples')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Update failed: ${error.message}`)
  return data
}

export async function getTrainingExampleCounts() {
  const client = getClient()
  if (!client) return []

  const { data, error } = await client
    .from('training_examples')
    .select('source_vendor, target_vendor')

  if (error) { console.error('[supabase] getTrainingCounts:', error.message); return [] }

  const counts = {}
  for (const row of (data ?? [])) {
    const key = `${row.source_vendor}→${row.target_vendor}`
    counts[key] = (counts[key] ?? 0) + 1
  }
  return Object.entries(counts).map(([pair, count]) => ({ pair, count }))
}

export async function getTrainingExamplesForConversion({ sourceVendor, targetVendor, limit = 5 }) {
  const client = getClient()
  if (!client) return []

  const { data, error } = await client
    .from('training_examples')
    .select('source_config, converted_config, description')
    .eq('source_vendor', sourceVendor)
    .eq('target_vendor', targetVendor)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) { console.error('[supabase] getTrainingExamples:', error.message); return [] }
  return data ?? []
}

// ── Custom vendors & products ─────────────────────────────────────────────────

export async function listCustomVendors() {
  const client = getClient()
  if (!client) return []
  const { data, error } = await client.from('custom_vendors').select('*').order('name')
  if (error) { console.error('[supabase] listCustomVendors:', error.message); return [] }
  return data ?? []
}

export async function saveCustomVendor(record) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')
  const { data, error } = await client.from('custom_vendors').insert(record).select().single()
  if (error) throw new Error(`Save vendor failed: ${error.message}`)
  return data
}

export async function deleteCustomVendor(id) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')
  // Delete products first, then vendor
  await client.from('custom_products').delete().eq('vendor_id', id)
  const { error } = await client.from('custom_vendors').delete().eq('id', id)
  if (error) throw new Error(`Delete vendor failed: ${error.message}`)
}

export async function listCustomProducts() {
  const client = getClient()
  if (!client) return []
  const { data, error } = await client.from('custom_products').select('*').order('full_name')
  if (error) { console.error('[supabase] listCustomProducts:', error.message); return [] }
  return data ?? []
}

export async function saveCustomProduct(record) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')
  const { data, error } = await client.from('custom_products').insert(record).select().single()
  if (error) throw new Error(`Save product failed: ${error.message}`)
  return data
}

export async function updateCustomProduct(id, updates) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')
  const { data, error } = await client.from('custom_products').update(updates).eq('id', id).select().single()
  if (error) throw new Error(`Update product failed: ${error.message}`)
  return data
}

export async function deleteCustomProduct(id) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')
  const { error } = await client.from('custom_products').delete().eq('id', id)
  if (error) throw new Error(`Delete product failed: ${error.message}`)
}

// ── Device types (Supabase sync) ─────────────────────────────────────────────

export async function listDeviceTypes() {
  const client = getClient()
  if (!client) return []
  const { data, error } = await client.from('device_types').select('*').order('label')
  if (error) { console.error('[supabase] listDeviceTypes:', error.message); return [] }
  return data ?? []
}

export async function saveDeviceType(record) {
  const client = getClient()
  if (!client) return null
  const { data, error } = await client
    .from('device_types')
    .upsert(record, { onConflict: 'name' })
    .select()
    .single()
  if (error) { console.error('[supabase] saveDeviceType:', error.message); return null }
  return data
}

// ── Setup wizard ─────────────────────────────────────────────────────────────

/**
 * Validate an invite code against the org_settings table.
 * Uses build-time credentials (not safeStore) so it works before setup.
 */
export async function validateInviteCode(code) {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return { valid: false, error: 'App build missing Supabase configuration' }
  }

  try {
    const tempClient = createClient(url, key)
    const { data, error } = await tempClient
      .from('org_settings')
      .select('org_name')
      .eq('invite_code', code.trim())
      .single()

    if (error || !data) {
      return { valid: false, error: 'Invalid invite code' }
    }
    return { valid: true, orgName: data.org_name }
  } catch (err) {
    return { valid: false, error: err.message }
  }
}
