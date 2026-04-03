// Renderer-side Supabase service — thin wrapper over IPC to main process
// All actual DB calls happen in src/main/api/supabase.js

export async function getRecentMigrations({ sourceVendor, targetVendor, limit = 10 }) {
  if (!window.electronAPI?.supabase) return []
  return await window.electronAPI.supabase.getRecentMigrations({ sourceVendor, targetVendor, limit })
}

export async function saveMigration(record) {
  if (!window.electronAPI?.supabase) throw new Error('App not ready — try again.')
  return await window.electronAPI.supabase.saveMigration(record)
}

export async function getMigrationStats() {
  if (!window.electronAPI?.supabase) return []
  return await window.electronAPI.supabase.getStats()
}

export async function testConnection() {
  if (!window.electronAPI?.supabase) return { ok: false, error: 'App not ready' }
  return await window.electronAPI.supabase.testConnection()
}

export function resetSupabaseClient() {
  window.electronAPI?.supabase?.reset()
}
