import { useState, useCallback } from 'react'
import { convertConfig } from '../services/claude'
import { getRecentMigrations } from '../services/supabase'

const INITIAL_STATE = {
  status: 'idle', // idle | loading | success | error
  result: null,   // { config, warnings, summary }
  error: null,
}

export function useConversion() {
  const [state, setState] = useState(INITIAL_STATE)

  const convert = useCallback(async ({ sourceConfig, sourceVendor, targetVendor }) => {
    setState({ status: 'loading', result: null, error: null })
    try {
      const examples = await getRecentMigrations({
        sourceVendor: sourceVendor.id,
        targetVendor: targetVendor.id,
        limit: 10,
      })

      const result = await convertConfig({ sourceConfig, sourceVendor, targetVendor, examples })
      setState({ status: 'success', result, error: null })
      return result
    } catch (err) {
      setState({ status: 'error', result: null, error: err.message })
      throw err
    }
  }, [])

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  return { ...state, convert, reset }
}
