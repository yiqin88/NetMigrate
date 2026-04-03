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
    setState({ ...INITIAL_STATE, status: 'loading', progressMessage: 'Preparing conversion…' })
    startProgressCycle()

    try {
      const examples = await getRecentMigrations({
        sourceVendor: sourceVendor.id,
        targetVendor: targetVendor.id,
        limit: 10,
      })

      setState((s) => ({ ...s, progressMessage: 'Sending config to Claude…' }))

      const result = await convertConfig({ sourceConfig, sourceVendor, targetVendor, examples })
      stopProgressCycle()
      setState({ status: 'success', result, error: null, progressMessage: '', elapsed: 0 })
      return result
    } catch (err) {
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
