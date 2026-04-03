import { useState, useCallback, useRef, useEffect } from 'react'
import { convertConfig } from '../services/claude'
import { getRecentMigrations } from '../services/supabase'

const PROGRESS_MESSAGES = [
  'Fetching learning examples…',
  'Sending config to Claude…',
  'Analysing VLANs and trunks…',
  'Converting interface configs…',
  'Mapping routing protocols…',
  'Translating STP settings…',
  'Generating Aruba CX syntax…',
  'Checking for conversion warnings…',
  'Finalising output…',
]

const INITIAL_STATE = {
  status: 'idle', // idle | loading | success | error
  result: null,   // { config, warnings, summary }
  error: null,
  progressMessage: '',
  elapsed: 0,
}

export function useConversion() {
  const [state, setState] = useState(INITIAL_STATE)
  const progressRef = useRef(null)
  const startTimeRef = useRef(0)

  // Clean up interval on unmount
  useEffect(() => {
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [])

  function startProgressCycle() {
    stopProgressCycle() // clear any previous interval
    let idx = 0
    startTimeRef.current = Date.now()

    setState((s) => ({
      ...s,
      progressMessage: PROGRESS_MESSAGES[0],
      elapsed: 0,
    }))

    progressRef.current = setInterval(() => {
      idx = Math.min(idx + 1, PROGRESS_MESSAGES.length - 1)
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
      setState((s) => ({
        ...s,
        progressMessage: PROGRESS_MESSAGES[idx],
        elapsed,
      }))
    }, 4000)
  }

  function stopProgressCycle() {
    if (progressRef.current) {
      clearInterval(progressRef.current)
      progressRef.current = null
    }
  }

  const convert = useCallback(async ({ sourceConfig, sourceVendor, targetVendor }) => {
    console.log('[useConversion] convert() called')
    setState({ ...INITIAL_STATE, status: 'loading', progressMessage: 'Preparing conversion…' })
    startProgressCycle()

    try {
      // Fetch learning examples with a 5-second timeout — don't let Supabase block the conversion
      let examples = []
      try {
        console.log('[useConversion] Fetching Supabase examples…')
        const exPromise = getRecentMigrations({
          sourceVendor: sourceVendor.id,
          targetVendor: targetVendor.id,
          limit: 10,
        })
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase timeout')), 5000)
        )
        examples = await Promise.race([exPromise, timeoutPromise])
        console.log('[useConversion] Got', examples.length, 'examples from Supabase')
      } catch (err) {
        console.warn('[useConversion] Supabase examples failed (non-blocking):', err.message)
        examples = []
      }

      setState((s) => ({ ...s, progressMessage: 'Sending config to Claude…' }))

      console.log('[useConversion] Calling convertConfig…')
      const result = await convertConfig({ sourceConfig, sourceVendor, targetVendor, examples })
      console.log('[useConversion] Conversion success!')
      stopProgressCycle()
      setState({ status: 'success', result, error: null, progressMessage: '', elapsed: 0 })
      return result
    } catch (err) {
      console.error('[useConversion] Conversion failed:', err.message)
      stopProgressCycle()
      setState({ status: 'error', result: null, error: err.message, progressMessage: '', elapsed: 0 })
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    stopProgressCycle()
    setState(INITIAL_STATE)
  }, [])

  return { ...state, convert, reset }
}
