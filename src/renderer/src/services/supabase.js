// Renderer-side Supabase service — thin wrapper over IPC to main process
// All actual DB calls happen in src/main/api/supabase.js

export async function getRecentMigrations({ sourceVendor, targetVendor, limit = 10 }) {
  return await window.electronAPI.supabase.getRecentMigrations({ sourceVendor, targetVendor, limit })
}

export async function saveMigration(record) {
  return await window.electronAPI.supabase.saveMigration(record)
}

export async function getMigrationStats() {
  return await window.electronAPI.supabase.getStats()
}

export async function testConnection() {
  return await window.electronAPI.supabase.testConnection()
}

export function resetSupabaseClient() {
  window.electronAPI.supabase.reset()
}
