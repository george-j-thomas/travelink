"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import Link from "next/link"
import { Loader2, PauseCircle } from "lucide-react"

// Drives the bio fetch queue from the browser: calls POST /api/artists/fetch-next
// in a loop, one artist per request. All queue state lives in the DB, so this can
// stop at any time (closing the tab, logging out) and pick up where it left off.

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BioQueueStatus = "idle" | "running" | "paused" | "not_configured" | "error"

export interface BioQueueState {
  status: BioQueueStatus
  remaining: number
  pausedUntil: number | null
  message: string | null
  currentHandle: string | null
}

/** An artist as returned by the artist API routes. */
export type FetchedArtist = { id: string; instagramHandle: string } & Record<string, unknown>

type FetchNextResponse =
  | { status: "processed"; outcome: string; artist: FetchedArtist | null; remaining: number; nextDelayMs: number }
  | { status: "idle"; remaining: number }
  | { status: "busy"; remaining: number; nextDelayMs: number }
  | { status: "rate_limited"; remaining: number; retryAfterMs: number; message: string }
  | { status: "not_configured"; remaining: number; message: string }

interface BioQueueContextValue {
  state: BioQueueState
  /** Starts the queue if it isn't already running (e.g. after adding artists). */
  kick: () => void
  /** Called with each artist as its bio fetch finishes. Returns an unsubscribe function. */
  onArtistFetched: (listener: (artist: FetchedArtist) => void) => () => void
}

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

// Shared across tabs so a reload doesn't hammer Instagram while it's throttling us
const PAUSE_STORAGE_KEY = "travelink.bioQueuePausedUntil"
const MAX_CONSECUTIVE_FAILURES = 5
const FAILURE_RETRY_MS = 30_000

function readPausedUntil(): number {
  try {
    return Number(localStorage.getItem(PAUSE_STORAGE_KEY)) || 0
  } catch {
    return 0
  }
}

function writePausedUntil(value: number) {
  try {
    localStorage.setItem(PAUSE_STORAGE_KEY, String(value))
  } catch {
    // Storage unavailable — the in-memory pause still applies
  }
}

const INITIAL_STATE: BioQueueState = {
  status: "idle",
  remaining: 0,
  pausedUntil: null,
  message: null,
  currentHandle: null,
}

const BioQueueContext = createContext<BioQueueContextValue | null>(null)

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function BioQueueProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BioQueueState>(INITIAL_STATE)
  const runningRef = useRef(false)
  const activeRef = useRef(true)
  const wakeRef = useRef<(() => void) | null>(null)
  const listenersRef = useRef(new Set<(artist: FetchedArtist) => void>())

  const sleep = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(done, ms)
        function done() {
          clearTimeout(timer)
          wakeRef.current = null
          resolve()
        }
        wakeRef.current = done
      }),
    []
  )

  const run = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    let failures = 0

    try {
      while (activeRef.current) {
        const pausedUntil = readPausedUntil()
        if (pausedUntil > Date.now()) {
          setState((s) => ({ ...s, status: "paused", pausedUntil, message: null }))
          await sleep(pausedUntil - Date.now())
          continue
        }

        let data: FetchNextResponse
        try {
          const res = await fetch("/api/artists/fetch-next", { method: "POST" })
          if (res.status === 401) {
            setState(INITIAL_STATE)
            return
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          data = (await res.json()) as FetchNextResponse
        } catch {
          failures++
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            setState((s) => ({
              ...s,
              status: "error",
              message: "Bio fetching stopped after repeated server errors. Reload the page to try again.",
            }))
            return
          }
          await sleep(FAILURE_RETRY_MS)
          continue
        }
        failures = 0

        switch (data.status) {
          case "processed": {
            const { artist } = data
            if (artist) listenersRef.current.forEach((notify) => notify(artist))
            setState({
              status: data.remaining > 0 ? "running" : "idle",
              remaining: data.remaining,
              pausedUntil: null,
              message: null,
              currentHandle: artist?.instagramHandle ?? null,
            })
            if (data.remaining === 0) return
            await sleep(data.nextDelayMs)
            break
          }
          case "busy":
            // Another tab holds the remaining claims
            setState((s) => ({ ...s, status: "running", remaining: data.remaining, pausedUntil: null }))
            await sleep(data.nextDelayMs)
            break
          case "rate_limited": {
            const until = Date.now() + data.retryAfterMs
            writePausedUntil(until)
            setState((s) => ({ ...s, status: "paused", remaining: data.remaining, pausedUntil: until }))
            break
          }
          case "not_configured":
            setState({ ...INITIAL_STATE, status: "not_configured", remaining: data.remaining, message: data.message })
            return
          case "idle":
          default:
            setState({ ...INITIAL_STATE, remaining: data.remaining })
            return
        }
      }
    } finally {
      runningRef.current = false
    }
  }, [sleep])

  useEffect(() => {
    activeRef.current = true
    void run()
    return () => {
      activeRef.current = false
      wakeRef.current?.()
    }
  }, [run])

  const kick = useCallback(() => {
    void run()
  }, [run])

  const onArtistFetched = useCallback((listener: (artist: FetchedArtist) => void) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const value = useMemo(() => ({ state, kick, onArtistFetched }), [state, kick, onArtistFetched])

  return (
    <BioQueueContext.Provider value={value}>
      {children}
      <BioQueuePill state={state} />
    </BioQueueContext.Provider>
  )
}

export function useBioQueue(): BioQueueContextValue {
  const ctx = useContext(BioQueueContext)
  if (!ctx) throw new Error("useBioQueue must be used inside BioQueueProvider")
  return ctx
}

export function formatResumeTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

/* ------------------------------------------------------------------ */
/*  Floating status pill                                               */
/* ------------------------------------------------------------------ */

function BioQueuePill({ state }: { state: BioQueueState }) {
  const visible =
    (state.status === "running" && state.remaining > 0) ||
    (state.status === "paused" && state.pausedUntil !== null)
  if (!visible) return null

  return (
    <Link
      href="/artists"
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-border/50 bg-background/80 px-4 py-2 text-xs text-muted-foreground shadow-2xl shadow-black/25 backdrop-blur-xl backdrop-saturate-150 transition-colors hover:text-foreground"
    >
      {state.status === "paused" ? (
        <>
          <PauseCircle className="size-3.5 text-brand-500" />
          Lookup limit reached · {state.remaining === 1 ? "1 bio resumes" : `${state.remaining} bios resume`} at{" "}
          {formatResumeTime(state.pausedUntil!)}
        </>
      ) : (
        <>
          <Loader2 className="size-3.5 animate-spin text-brand-500" />
          Fetching bios · {state.remaining} left
        </>
      )}
    </Link>
  )
}
