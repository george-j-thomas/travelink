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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Step = "method" | "select" | "processing" | "complete"

interface ImportJob {
  id: string
  status: "processing" | "completed" | "cancelled"
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

const POLL_INTERVAL_MS = 2000

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function estimateTime(count: number): string {
  const totalSeconds = count * 2
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.ceil(totalSeconds / 60)
  return `${minutes} min`
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // -- Step state
  const [step, setStep] = useState<Step>("method")

  // -- Method state
  const [sessionCookie, setSessionCookie] = useState("")
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

  // -- Complete state
  const [finalJob, setFinalJob] = useState<ImportJob | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  /* ---------------------------------------------------------------- */
  /*  Cleanup                                                          */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Reset                                                            */
  /* ---------------------------------------------------------------- */

  function resetAll() {
    stopPolling()
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

    const trimmed = sessionCookie.trim()
    if (!trimmed) {
      setError("Please enter your session cookie")
      return
    }

    setIsFetching(true)

    try {
      const res = await fetch("/api/import/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: trimmed }),
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(
          res.status === 429
            ? "Rate limited — please try again in a few minutes"
            : data.error || "Failed to fetch following list"
        )
        return
      }

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
        body: JSON.stringify({ handles: Array.from(selectedHandles) }),
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
      setStep("processing")

      // Start polling
      pollRef.current = setInterval(() => pollJob(id), POLL_INTERVAL_MS)
    } catch {
      setError("Network error — check your connection and try again")
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Poll job status                                                   */
  /* ---------------------------------------------------------------- */

  async function pollJob(id: string) {
    try {
      const res = await fetch(`/api/import/${id}`)
      if (!res.ok) return

      const data = (await res.json()) as ImportJob

      setJob(data)

      if (data.status === "completed" || data.status === "cancelled") {
        stopPolling()
        setFinalJob(data)
        setStep("complete")
      }
    } catch {
      // Silently retry on next poll
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Cancel import                                                     */
  /* ---------------------------------------------------------------- */

  async function cancelImport() {
    if (!jobId) return

    try {
      await fetch(`/api/import/${jobId}`, { method: "DELETE" })
      // Polling will pick up the cancelled status
    } catch {
      // Will be retried via polling
    }
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
                      placeholder="Paste sessionid value…"
                      autoComplete="off"
                      value={sessionCookie}
                      onChange={(e) => {
                        setSessionCookie(e.target.value)
                        if (error) setError(null)
                      }}
                      disabled={isFetching}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-amber-500 font-medium text-black hover:bg-amber-400"
                    disabled={isFetching || !sessionCookie.trim()}
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
              {job.total} artists × ~2s each ≈ {estimateTime(job.total)}
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

            {/* Current handle */}
            {job.currentHandle && (
              <div className="flex items-center gap-2.5 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                <span className="text-muted-foreground">
                  Processing{" "}
                  <span className="font-medium text-foreground">
                    @{job.currentHandle}
                  </span>
                  …
                </span>
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

          <CardFooter>
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
