import { useState, useCallback, useRef, useEffect } from 'react'
import { convertConfig } from '../services/claude'
import { getRecentMigrations } from '../services/supabase'

const INITIAL_MESSAGES = [
  'Fetching learning examples…',
  'Sending config to Claude…',
]

const STREAMING_MESSAGES = [
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
  result: null,
  error: null,
  progressMessage: '',
  elapsed: 0,
  streamChars: 0,
}

export function useConversion() {
  const [state, setState] = useState(INITIAL_STATE)
  const timerRef = useRef(null)
  const startTimeRef = useRef(0)
  const cleanupProgressRef = useRef(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (cleanupProgressRef.current) cleanupProgressRef.current()
    }
  }, [])

  function startTimer() {
    stopTimer()
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
      setState((s) => ({ ...s, elapsed }))
    }, 1000)
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function listenForStreamProgress() {
    // Clean up previous listener
    if (cleanupProgressRef.current) cleanupProgressRef.current()

    const cleanup = window.electronAPI?.claude?.onConvertProgress?.((data) => {
      const msgIdx = Math.min(
        Math.floor(data.chars / 500),
        STREAMING_MESSAGES.length - 1
      )
      setState((s) => ({
        ...s,
        streamChars: data.chars,
        progressMessage: `${STREAMING_MESSAGES[msgIdx]} (${data.chars.toLocaleString()} chars)`,
      }))
    })
    cleanupProgressRef.current = cleanup ?? null
  }

  const convert = useCallback(async ({ sourceConfig, sourceVendor, targetVendor }) => {
    console.log('[useConversion] convert() called')
    setState({ ...INITIAL_STATE, status: 'loading', progressMessage: INITIAL_MESSAGES[0] })
    startTimer()
    listenForStreamProgress()

    try {
      // Fetch learning examples + training examples with a 5-second timeout
      let examples = []
      try {
        console.log('[useConversion] Fetching examples…')
        setState((s) => ({ ...s, progressMessage: INITIAL_MESSAGES[0] }))

        const timeout = (p) => Promise.race([
          p,
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
        ])

        const [migrations, training] = await Promise.all([
          timeout(getRecentMigrations({
            sourceVendor: sourceVendor.id,
            targetVendor: targetVendor.id,
            limit: 10,
          })).catch(() => []),
          timeout(
            window.electronAPI?.training?.getExamples?.({
              sourceVendor: sourceVendor.id,
              targetVendor: targetVendor.id,
              limit: 5,
            }) ?? Promise.resolve([])
          ).catch(() => []),
        ])

        // Training examples first (curated), then past migrations
        examples = [...training, ...migrations]
        console.log('[useConversion] Got', training.length, 'training +', migrations.length, 'migration examples')
      } catch (err) {
        console.warn('[useConversion] Examples failed (non-blocking):', err.message)
        examples = []
      }

      setState((s) => ({ ...s, progressMessage: INITIAL_MESSAGES[1] }))

      console.log('[useConversion] Calling convertConfig (streaming)…')
      const result = await convertConfig({ sourceConfig, sourceVendor, targetVendor, examples })
      console.log('[useConversion] Conversion success!')

      stopTimer()
      if (cleanupProgressRef.current) cleanupProgressRef.current()
      setState({ status: 'success', result, error: null, progressMessage: '', elapsed: 0, streamChars: 0 })
      return result
    } catch (err) {
      console.error('[useConversion] Failed:', err.message)
      stopTimer()
      if (cleanupProgressRef.current) cleanupProgressRef.current()
      setState({ status: 'error', result: null, error: err.message, progressMessage: '', elapsed: 0, streamChars: 0 })
      throw err
    }
  }, [])

  const reset = useCallback(() => {
    stopTimer()
    if (cleanupProgressRef.current) cleanupProgressRef.current()
    setState(INITIAL_STATE)
  }, [])

  return { ...state, convert, reset }
}
