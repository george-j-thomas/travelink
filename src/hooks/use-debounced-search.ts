"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Resolves to null when the search failed (failures aren't cached). */
export type SearchFetcher<T> = (query: string, signal: AbortSignal) => Promise<T | null>

interface SearchState<T> {
  /** The query `results` are for */
  query: string
  results: T | null
  loading: boolean
  /** The search for `query` failed (the fetcher resolved to null or threw) */
  failed: boolean
}

/**
 * Search-as-you-type: runs `fetcher` once typing pauses for `debounceMs`,
 * aborts superseded requests and caches results per query (case-insensitive).
 * The previous results stay while the next search loads, so lists don't flicker.
 */
export function useDebouncedSearch<T>(fetcher: SearchFetcher<T>, debounceMs: number) {
  const [state, setState] = useState<SearchState<T>>({
    query: "",
    results: null,
    loading: false,
    failed: false,
  })
  const fetcherRef = useRef(fetcher)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const cacheRef = useRef(new Map<string, T>())

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  useEffect(() => stop, [stop])

  const search = useCallback(
    (query: string) => {
      stop()
      const key = query.toLowerCase()
      const cached = cacheRef.current.get(key)
      if (cached !== undefined) {
        setState({ query, results: cached, loading: false, failed: false })
        return
      }

      setState((s) => (s.loading ? s : { ...s, loading: true }))
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const controller = new AbortController()
        abortRef.current = controller
        fetcherRef
          .current(query, controller.signal)
          .catch(() => null)
          .then((results) => {
            if (controller.signal.aborted) return
            abortRef.current = null
            if (results !== null) cacheRef.current.set(key, results)
            setState({ query, results, loading: false, failed: results === null })
          })
      }, debounceMs)
    },
    [stop, debounceMs]
  )

  /** Stops a pending search, keeping the current results. */
  const cancel = useCallback(() => {
    stop()
    setState((s) => (s.loading ? { ...s, loading: false } : s))
  }, [stop])

  /** Stops a pending search and drops the results. */
  const clear = useCallback(() => {
    stop()
    setState({ query: "", results: null, loading: false, failed: false })
  }, [stop])

  /** Like `clear`, and forgets cached results too (when they may have changed). */
  const reset = useCallback(() => {
    clear()
    cacheRef.current.clear()
  }, [clear])

  return { ...state, search, cancel, clear, reset }
}
