"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Cookie,
  Download,
  Loader2,
  Search,
  Upload,
  X,
  XCircle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useInstagramCookie } from "@/hooks/use-instagram-cookie"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Step = "method" | "select" | "processing" | "complete"

interface ImportJob {
  id: string
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  total: number
  completed: number
  failed: number
  skipped: number
  currentHandle: string | null
  errors: { handle: string; error: string }[]
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

// Consecutive network failures tolerated before the import loop gives up
const MAX_NETWORK_FAILURES = 5
const NETWORK_RETRY_MS = 10_000

interface ImportRun {
  cancelled: boolean
  wake: (() => void) | null
}

interface NextResponse {
  job: ImportJob
  nextDelayMs: number | null
  retry: boolean
}

type ImportPhase = "processing" | "waiting" | "backoff"

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

// Must match the pacing in src/lib/import-runner.ts
const SECONDS_PER_ARTIST_SCRAPE = 25
const SECONDS_PER_ARTIST_API = 2

/** Sleeps for `ms`, returning early if the run is cancelled. */
function sleepUnlessCancelled(ms: number, run: ImportRun): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      run.wake = null
      resolve()
    }, ms)
    run.wake = () => {
      clearTimeout(timer)
      run.wake = null
      resolve()
    }
  })
}

function estimateTime(count: number, secondsPerArtist: number): string {
  const totalSeconds = count * secondsPerArtist
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.ceil(totalSeconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem ? `${hours}h ${rem}m` : `${hours}h`
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function CollapsibleInstructions({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {open ? "Hide instructions" : "Show instructions"}
      </button>

      {open && (
        <ol className="mt-3 grid gap-2 text-sm text-muted-foreground">
          {children}
        </ol>
      )}
    </div>
  )
}

function InstructionStep({
  number,
  children,
}: {
  number: number
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[11px] font-semibold text-amber-400">
        {number}
      </span>
      <span className="pt-px leading-5">{children}</span>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ImportArtistsPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const runRef = useRef<ImportRun | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // -- Step state
  const [step, setStep] = useState<Step>("method")

  // -- Method state
  const [sessionCookie, setSessionCookie] = useState("")
  const {
    cookie: savedCookie,
    save: saveCookie,
    clear: clearSavedCookie,
  } = useInstagramCookie()
  // A freshly pasted cookie wins over the one remembered in this browser
  const cookie = sessionCookie.trim() || savedCookie
  const [importSource, setImportSource] = useState<"upload" | "scrape">("upload")
  const [isUploading, setIsUploading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // -- Select state
  const [allHandles, setAllHandles] = useState<string[]>([])
  const [trackedHandles, setTrackedHandles] = useState<Set<string>>(new Set())
  const [selectedHandles, setSelectedHandles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")

  // -- Processing state
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<ImportJob | null>(null)
  const [phase, setPhase] = useState<ImportPhase>("processing")

  // -- Complete state
  const [finalJob, setFinalJob] = useState<ImportJob | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  /* ---------------------------------------------------------------- */
  /*  Cleanup                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    return () => stopRun()
  }, [])

  // The import is driven by this tab — warn before closing it mid-import
  useEffect(() => {
    if (step !== "processing") return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [step])

  function stopRun() {
    const run = runRef.current
    if (run) {
      run.cancelled = true
      run.wake?.()
      runRef.current = null
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Reset                                                            */
  /* ---------------------------------------------------------------- */

  function resetAll() {
    stopRun()
    setStep("method")
    setSessionCookie("")
    setIsUploading(false)
    setIsFetching(false)
    setError(null)
    setIsDragOver(false)
    setAllHandles([])
    setTrackedHandles(new Set())
    setSelectedHandles(new Set())
    setSearchQuery("")
    setJobId(null)
    setJob(null)
    setFinalJob(null)
    setShowErrors(false)
  }

  /* ---------------------------------------------------------------- */
  /*  Fetch existing artists for cross-reference                       */
  /* ---------------------------------------------------------------- */

  const fetchTrackedHandles = useCallback(async (): Promise<Set<string>> => {
    try {
      const res = await fetch("/api/artists")
      if (res.status === 401) {
        router.push("/login")
        return new Set()
      }
      if (!res.ok) return new Set()
      const data = await res.json()
      const handles = new Set<string>(
        (data.artists ?? data ?? []).map(
          (a: { instagramHandle: string }) =>
            a.instagramHandle.toLowerCase()
        )
      )
      return handles
    } catch {
      return new Set()
    }
  }, [router])

  /* ---------------------------------------------------------------- */
  /*  Transition to Select step                                        */
  /* ---------------------------------------------------------------- */

  async function goToSelect(handles: string[]) {
    const tracked = await fetchTrackedHandles()
    setTrackedHandles(tracked)
    setAllHandles(handles)

    // Pre-select handles that aren't already tracked
    const preSelected = new Set<string>(
      handles.filter((h) => !tracked.has(h.toLowerCase()))
    )
    setSelectedHandles(preSelected)
    setStep("select")
  }

  /* ---------------------------------------------------------------- */
  /*  File upload handler                                               */
  /* ---------------------------------------------------------------- */

  async function handleFile(file: File) {
    setError(null)

    if (!file.name.endsWith(".json")) {
      setError("Please upload a .json file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large (max 10 MB)")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/import/upload", {
        method: "POST",
        body: formData,
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to parse file")
        return
      }

      setImportSource("upload")
      await goToSelect(data.handles as string[])
    } catch {
      setError("Network error — check your connection and try again")
    } finally {
      setIsUploading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  /* ---------------------------------------------------------------- */
  /*  Drag-and-drop handlers                                           */
  /* ---------------------------------------------------------------- */

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  /* ---------------------------------------------------------------- */
  /*  Cookie fetch handler                                              */
  /* ---------------------------------------------------------------- */

  async function handleCookieFetch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!cookie) {
      setError("Please enter your session cookie")
      return
    }

    setIsFetching(true)

    try {
      const res = await fetch("/api/import/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: cookie }),
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        if (data.code === "instagram_session" && cookie === savedCookie) {
          clearSavedCookie()
        }
        setError(
          res.status === 429
            ? "Rate limited — please try again in a few minutes"
            : data.error || "Failed to fetch following list"
        )
        return
      }

      saveCookie(cookie)
      setSessionCookie("")
      setImportSource("scrape")
      await goToSelect(data.handles as string[])
    } catch {
      setError("Network error — check your connection and try again")
    } finally {
      setIsFetching(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Selection helpers                                                 */
  /* ---------------------------------------------------------------- */

  const filteredHandles = allHandles.filter((h) =>
    h.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectableHandles = filteredHandles.filter(
    (h) => !trackedHandles.has(h.toLowerCase())
  )

  function toggleHandle(handle: string) {
    setSelectedHandles((prev) => {
      const next = new Set(prev)
      if (next.has(handle)) {
        next.delete(handle)
      } else {
        next.add(handle)
      }
      return next
    })
  }

  function toggleAll() {
    if (selectedHandles.size === selectableHandles.length) {
      setSelectedHandles(new Set())
    } else {
      setSelectedHandles(new Set(selectableHandles))
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Start import                                                      */
  /* ---------------------------------------------------------------- */

  async function startImport() {
    setError(null)

    if (selectedHandles.size === 0) {
      setError("Please select at least one handle to import")
      return
    }

    try {
      const res = await fetch("/api/import/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handles: Array.from(selectedHandles),
          source: importSource,
        }),
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(
          res.status === 409
            ? "An import is already in progress"
            : data.error || "Failed to start import"
        )
        return
      }

      const id = data.jobId as string
      setJobId(id)
      setJob({
        id,
        status: "processing",
        total: selectedHandles.size,
        completed: 0,
        failed: 0,
        skipped: 0,
        currentHandle: null,
        errors: [],
      })
      setPhase("processing")
      setStep("processing")

      void runImport(id, cookie)
    } catch {
      setError("Network error — check your connection and try again")
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Drive the import: one artist per request, paced by the server     */
  /* ---------------------------------------------------------------- */

  async function runImport(id: string, cookie: string) {
    stopRun()
    const run: ImportRun = { cancelled: false, wake: null }
    runRef.current = run

    let retry = false
    let networkFailures = 0

    while (!run.cancelled) {
      setPhase(retry ? "backoff" : "processing")

      let res: Response
      try {
        res = await fetch(`/api/import/${id}/next`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: cookie || undefined, retry }),
        })
      } catch {
        networkFailures++
        if (networkFailures >= MAX_NETWORK_FAILURES) {
          setError("Lost connection to the server — the import is paused. Resume to continue.")
          return
        }
        await sleepUnlessCancelled(NETWORK_RETRY_MS, run)
        continue
      }
      if (run.cancelled) return

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setError(data?.error || "Import paused after a server error. Resume to continue.")
        return
      }

      networkFailures = 0
      const { job: latest, nextDelayMs, retry: shouldRetry } = data as NextResponse
      setJob(latest)

      if (nextDelayMs === null) {
        runRef.current = null
        setFinalJob(latest)
        setStep("complete")
        return
      }

      retry = shouldRetry
      if (nextDelayMs > 0) {
        setPhase(shouldRetry ? "backoff" : "waiting")
        await sleepUnlessCancelled(nextDelayMs, run)
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Cancel import                                                     */
  /* ---------------------------------------------------------------- */

  async function cancelImport() {
    if (!jobId) return
    stopRun()

    try {
      const res = await fetch(`/api/import/${jobId}`, { method: "DELETE" })
      const data = res.ok ? ((await res.json()) as ImportJob) : null
      setFinalJob(data ?? (job ? { ...job, status: "cancelled" } : null))
    } catch {
      setFinalJob(job ? { ...job, status: "cancelled" } : null)
    }
    setStep("complete")
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-2xl pt-2 sm:pt-8">
      {/* Back link */}
      <Link
        href="/artists"
        className="group/back mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover/back:-translate-x-0.5" />
        Artists
      </Link>

      {/* ============================================================ */}
      {/*  Step 1 — Choose Method                                       */}
      {/* ============================================================ */}
      {step === "method" && (
        <>
          <h1 className="mb-6 text-xl font-semibold tracking-tight">
            Import Artists
          </h1>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Card A — Upload Data Export */}
            <Card className="border-border/50 shadow-2xl shadow-black/25">
              <CardHeader className="pb-3">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Upload className="h-5 w-5 text-amber-400" />
                </div>
                <CardTitle className="text-base font-semibold">
                  Upload Data Export
                </CardTitle>
                <CardDescription className="text-[13px] leading-relaxed">
                  Download your data from Instagram Settings, then upload the
                  following.json file
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <CollapsibleInstructions>
                  <InstructionStep number={1}>
                    Go to Instagram → Settings → Accounts Center
                  </InstructionStep>
                  <InstructionStep number={2}>
                    Your Information and Permissions → Download Your Information
                  </InstructionStep>
                  <InstructionStep number={3}>
                    Request Download (select <strong>JSON</strong> format)
                  </InstructionStep>
                  <InstructionStep number={4}>
                    Wait for email, download zip, find{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                      connections/followers_and_following/following.json
                    </code>
                  </InstructionStep>
                </CollapsibleInstructions>

                <Separator />

                {/* Drag-and-drop zone */}
                <div
                  ref={dropZoneRef}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    isDragOver
                      ? "border-amber-500/60 bg-amber-500/5"
                      : "border-border/60 hover:border-amber-500/40 hover:bg-amber-500/5"
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                  ) : (
                    <Download className="h-6 w-6 text-muted-foreground/60" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isUploading
                      ? "Parsing file…"
                      : "Drop .json file here or click to browse"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onFileChange}
                />
              </CardContent>
            </Card>

            {/* Card B — Paste Session Cookie */}
            <Card className="border-border/50 shadow-2xl shadow-black/25">
              <CardHeader className="pb-3">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                  <Cookie className="h-5 w-5 text-amber-400" />
                </div>
                <CardTitle className="text-base font-semibold">
                  Paste Session Cookie
                </CardTitle>
                <CardDescription className="text-[13px] leading-relaxed">
                  Copy your Instagram session cookie for instant import
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <CollapsibleInstructions>
                  <InstructionStep number={1}>
                    Open{" "}
                    <strong>instagram.com</strong> in your browser and make sure
                    you&apos;re logged in
                  </InstructionStep>
                  <InstructionStep number={2}>
                    Open DevTools (F12) → Application tab → Cookies →
                    instagram.com
                  </InstructionStep>
                  <InstructionStep number={3}>
                    Find the{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                      sessionid
                    </code>{" "}
                    cookie and copy its value
                  </InstructionStep>
                </CollapsibleInstructions>

                <Separator />

                <form onSubmit={handleCookieFetch} className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="sessionCookie" className="text-[13px]">
                      Session cookie
                    </Label>
                    <Input
                      id="sessionCookie"
                      type="password"
                      placeholder={
                        savedCookie
                          ? "Using your saved session — paste to replace"
                          : "Paste sessionid value…"
                      }
                      autoComplete="off"
                      value={sessionCookie}
                      onChange={(e) => {
                        setSessionCookie(e.target.value)
                        if (error) setError(null)
                      }}
                      disabled={isFetching}
                    />
                    {savedCookie && (
                      <p className="text-xs text-muted-foreground">
                        Remembered in this browser only.{" "}
                        <button
                          type="button"
                          onClick={clearSavedCookie}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Forget it
                        </button>
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-amber-500 font-medium text-black hover:bg-amber-400"
                    disabled={isFetching || !cookie}
                  >
                    {isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {isFetching ? "Fetching…" : "Fetch Following List"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/*  Step 2 — Select Handles                                      */}
      {/* ============================================================ */}
      {step === "select" && (
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight">
                  Import Artists
                </CardTitle>
                <CardDescription className="mt-1">
                  Found{" "}
                  <span className="font-medium text-foreground">
                    {allHandles.length}
                  </span>{" "}
                  accounts you follow
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Search + select all */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  type="text"
                  placeholder="Filter handles…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleAll}
                className="shrink-0"
              >
                {selectedHandles.size === selectableHandles.length &&
                selectableHandles.length > 0
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            {/* Handle list */}
            <div
              className="max-h-[420px] overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/30"
              role="list"
              aria-label="Instagram handles"
            >
              {filteredHandles.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No handles match your search
                </p>
              ) : (
                filteredHandles.map((handle) => {
                  const isTracked = trackedHandles.has(handle.toLowerCase())
                  const isSelected = selectedHandles.has(handle)

                  return (
                    <label
                      key={handle}
                      className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
                        isTracked
                          ? "opacity-50"
                          : isSelected
                            ? "bg-amber-500/5"
                            : "hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isTracked}
                        onChange={() => toggleHandle(handle)}
                        className="h-4 w-4 rounded border-border accent-amber-500"
                      />
                      <span
                        className={`text-sm ${
                          isTracked
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        @{handle}
                      </span>
                      {isTracked && (
                        <Badge
                          variant="secondary"
                          className="ml-auto text-[11px]"
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Already tracked
                        </Badge>
                      )}
                    </label>
                  )
                })
              )}
            </div>
          </CardContent>

          {/* Bottom sticky bar */}
          <CardFooter className="flex-col gap-3 border-t border-border/30 bg-card/80 pt-4 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setStep("method")
                setError(null)
              }}
              className="w-full sm:w-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <div className="flex flex-1 items-center justify-between gap-3 sm:justify-end">
              <span className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {selectedHandles.size}
                </span>{" "}
                selected
              </span>
              <Button
                onClick={startImport}
                disabled={selectedHandles.size === 0}
                className="bg-amber-500 font-medium text-black hover:bg-amber-400"
              >
                Import Selected
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  Step 3 — Processing                                          */}
      {/* ============================================================ */}
      {step === "processing" && job && (
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Importing Artists
            </CardTitle>
            <CardDescription>
              {job.total} artists × ~{cookie ? SECONDS_PER_ARTIST_SCRAPE : SECONDS_PER_ARTIST_API}s each ≈{" "}
              {estimateTime(
                job.total,
                cookie ? SECONDS_PER_ARTIST_SCRAPE : SECONDS_PER_ARTIST_API
              )}
              {cookie && " — paced slowly to protect your Instagram account"}.
              Keep this tab open until it finishes.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-5">
            {/* Progress bar */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {job.completed + job.failed + job.skipped} of {job.total}
                </span>
                <span className="font-medium text-foreground">
                  {job.total > 0
                    ? Math.round(
                        ((job.completed + job.failed + job.skipped) /
                          job.total) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{
                    width: `${
                      job.total > 0
                        ? ((job.completed + job.failed + job.skipped) /
                            job.total) *
                          100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* Current activity */}
            <div className="flex items-center gap-2.5 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              <span className="text-muted-foreground">
                {phase === "backoff"
                  ? "Instagram asked us to slow down — retrying in a few minutes…"
                  : phase === "waiting"
                    ? "Waiting before the next artist…"
                    : "Processing next artist…"}
                {job.currentHandle && phase !== "backoff" && (
                  <>
                    {" "}Last:{" "}
                    <span className="font-medium text-foreground">
                      @{job.currentHandle}
                    </span>
                  </>
                )}
              </span>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Separator />

            {/* Stats row */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Imported:{" "}
                <span className="font-medium text-foreground">
                  {job.completed}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Skipped:{" "}
                <span className="font-medium text-foreground">
                  {job.skipped}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                Failed:{" "}
                <span className="font-medium text-foreground">
                  {job.failed}
                </span>
              </span>
            </div>
          </CardContent>

          <CardFooter className="gap-2">
            {error && jobId && (
              <Button
                onClick={() => {
                  setError(null)
                  void runImport(jobId, cookie)
                }}
                className="bg-amber-500 font-medium text-black hover:bg-amber-400"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Resume
              </Button>
            )}
            <Button
              variant="outline"
              onClick={cancelImport}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              <X className="h-3.5 w-3.5" />
              Cancel Import
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ============================================================ */}
      {/*  Step 4 — Complete                                             */}
      {/* ============================================================ */}
      {step === "complete" && finalJob && (
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              {finalJob.status === "completed" ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                </span>
              ) : (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10">
                  <XCircle className="h-3.5 w-3.5 text-amber-400" />
                </span>
              )}
              <CardTitle className="text-xl font-semibold tracking-tight">
                {finalJob.status === "completed"
                  ? "Import Complete"
                  : finalJob.status === "failed"
                    ? "Import Stopped"
                    : "Import Cancelled"}
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="grid gap-5">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-emerald-500/10 px-4 py-3 text-center">
                <p className="text-2xl font-semibold text-emerald-400">
                  {finalJob.completed}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Imported
                </p>
              </div>
              <div className="rounded-lg bg-amber-500/10 px-4 py-3 text-center">
                <p className="text-2xl font-semibold text-amber-400">
                  {finalJob.skipped}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Skipped
                </p>
              </div>
              <div className="rounded-lg bg-red-500/10 px-4 py-3 text-center">
                <p className="text-2xl font-semibold text-red-400">
                  {finalJob.failed}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Failed
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {finalJob.completed} artist{finalJob.completed !== 1 ? "s" : ""}{" "}
              imported, {finalJob.skipped} already tracked, {finalJob.failed}{" "}
              failed
            </p>

            {/* Errors section */}
            {finalJob.errors.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowErrors(!showErrors)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive transition-colors hover:text-destructive/80"
                >
                  {showErrors ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {finalJob.errors.length} failed handle
                  {finalJob.errors.length !== 1 ? "s" : ""}
                </button>

                {showErrors && (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-border/40 divide-y divide-border/30">
                    {finalJob.errors.map(({ handle, error: errMsg }) => (
                      <div
                        key={handle}
                        className="flex items-start gap-2.5 px-4 py-2.5 text-sm"
                      >
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                        <div className="min-w-0">
                          <span className="font-medium">@{handle}</span>
                          <p className="text-muted-foreground">{errMsg}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="gap-3">
            <Button variant="outline" onClick={resetAll}>
              Import More
            </Button>
            <Button
              className="ml-auto bg-amber-500 font-medium text-black hover:bg-amber-400"
              render={<Link href="/artists" />}
            >
              View Your Artists
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
