// Main-process Knowledge Base service — CRUD for command_knowledge_base table

import { getClient } from './supabase.js'

const TABLE = 'command_knowledge_base'

export async function listKBEntries({ sourceProduct, targetProduct, category, confidence, search, limit = 500 } = {}) {
  const client = getClient()
  if (!client) return []

  let query = client.from(TABLE).select('*').order('category').order('source_command')

  if (sourceProduct) query = query.eq('source_product', sourceProduct)
  if (targetProduct) query = query.eq('target_product', targetProduct)
  if (category) query = query.eq('category', category)
  if (confidence) query = query.eq('confidence', confidence)
  if (search) query = query.or(`source_command.ilike.%${search}%,target_command.ilike.%${search}%`)
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) { console.error('[kb] list:', error.message); return [] }
  return data ?? []
}

export async function saveBatchKBEntries(entries) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')

  // Supabase supports bulk insert
  const { data, error } = await client.from(TABLE).insert(entries).select()
  if (error) throw new Error(`KB save failed: ${error.message}`)
  console.log(`[kb] Saved ${data.length} entries`)
  return data
}

export async function updateKBEntry(id, updates) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')

  const { data, error } = await client
    .from(TABLE)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`KB update failed: ${error.message}`)
  return data
}

export async function deleteKBEntry(id) {
  const client = getClient()
  if (!client) throw new Error('Supabase not configured.')

  const { error } = await client.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(`KB delete failed: ${error.message}`)
}

export async function getKBStats() {
  const client = getClient()
  if (!client) return { total: 0, byCategory: {}, vendorPairs: [], lastUpdated: null }

  const { data, error } = await client
    .from(TABLE)
    .select('category, confidence, source_product, target_product, source_type, updated_at')

  if (error) { console.error('[kb] stats:', error.message); return { total: 0, byCategory: {}, vendorPairs: [], lastUpdated: null } }

  const rows = data ?? []
  const byCategory = {}
  const vendorPairSet = new Set()
  let lastUpdated = null

  for (const r of rows) {
    byCategory[r.category] = (byCategory[r.category] ?? 0) + 1
    vendorPairSet.add(`${r.source_product}→${r.target_product}`)
    if (!lastUpdated || r.updated_at > lastUpdated) lastUpdated = r.updated_at
  }

  return {
    total: rows.length,
    byCategory,
    vendorPairs: [...vendorPairSet],
    lastUpdated,
    byConfidence: {
      high: rows.filter((r) => r.confidence === 'high').length,
      medium: rows.filter((r) => r.confidence === 'medium').length,
      low: rows.filter((r) => r.confidence === 'low').length,
    },
    bySource: {
      doc_upload: rows.filter((r) => r.source_type === 'doc_upload').length,
      web_search: rows.filter((r) => r.source_type === 'web_search').length,
      manual: rows.filter((r) => r.source_type === 'manual').length,
      training: rows.filter((r) => r.source_type === 'training').length,
    },
  }
}

export async function getKBForConversion({ sourceProduct, targetProduct }) {
  const client = getClient()
  if (!client) return []

  const { data, error } = await client
    .from(TABLE)
    .select('source_command, target_command, category, confidence')
    .eq('source_product', sourceProduct)
    .eq('target_product', targetProduct)
    .eq('verified_by_human', true)
    .order('category')

  if (error) { console.error('[kb] getForConversion:', error.message); return [] }
  return data ?? []
}

export function exportKBAsCSV(entries) {
  const headers = 'source_vendor,source_product,target_vendor,target_product,source_command,target_command,category,confidence,source_type,notes'
  const rows = entries.map((e) => [
    e.source_vendor, e.source_product, e.target_vendor, e.target_product,
    `"${(e.source_command ?? '').replace(/"/g, '""')}"`,
    `"${(e.target_command ?? '').replace(/"/g, '""')}"`,
    e.category, e.confidence, e.source_type ?? 'manual',
    `"${(e.notes ?? '').replace(/"/g, '""')}"`,
  ].join(','))
  return [headers, ...rows].join('\n')
}
