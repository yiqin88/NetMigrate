import { useState, useEffect } from 'react'
import { getMigrationStats, saveMigration } from '../services/supabase'

export function useMigrations() {
  const [migrations, setMigrations] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function fetch() {
      setLoading(true)
      const data = await getMigrationStats()
      if (data) setMigrations(data)
      setLoading(false)
    }
    fetch()
  }, [])

  async function approveMigration({
    sourceConfig,
    convertedConfig,
    sourceVendor,
    targetVendor,
    accuracyRating,
    corrections = 0,
    conversionSummary = null,
    warnings = [],
    notes = null,
  }) {
    const record = {
      source_vendor: sourceVendor.id,
      target_vendor: targetVendor.id,
      source_config: sourceConfig,
      converted_config: convertedConfig,
      accuracy_rating: accuracyRating,
      corrections_made: corrections,
      conversion_summary: conversionSummary,
      warnings: warnings.length > 0 ? warnings : null,
      created_at: new Date().toISOString(),
    }
    const saved = await saveMigration(record)
    setMigrations((prev) => [...prev, saved])
    return saved
  }

  return { migrations, loading, approveMigration }
}
