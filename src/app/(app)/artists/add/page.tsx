"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Circle,
  Loader2,
  MapPin,
  Plus,
  Search,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { useBioQueue } from "@/components/bio-queue"
import { useInstagramCookie } from "@/hooks/use-instagram-cookie"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SearchUser {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  isVerified: boolean
  isPrivate: boolean
}

interface ArtistLocation {
  id: string
  locationName: string
  city: string | null
  country: string | null
  lat: number | null
  lng: number | null
  isPrimary: boolean
  isGuestSpot: boolean
  startDate: string | null
  endDate: string | null
  source: string
}

interface ArtistResult {
  artist: {
    id: string
    instagramHandle: string
    displayName: string | null
    bio: string | null
    profilePicUrl: string | null
    accountType: string
    fetchStatus: "pending" | "fetched" | "unavailable" | "failed"
    locations: ArtistLocation[]
  }
  status: "created" | "existing"
  warnings: string[]
}

type ViewState = "idle" | "loading" | "success"

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS = [
  "Fetching profile",
  "Parsing bio",
  "Geocoding locations",
] as const

const STEP_ADVANCE_MS = 1200
const DONE_PAUSE_MS = 500

// Each search is a paid lookup (or a request with the user's cookie) — keep them sparse
const SEARCH_DEBOUNCE_MS = 400
const SEARCH_MIN_CHARS = 2

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stripAt(raw: string) {
  return raw.replace(/^@+/, "").trim()
}

function validateHandle(value: string): string | null {
  if (!value) return "Please enter an Instagram handle"
  if (value.length > 30) return "Handle is too long (max 30 characters)"
  if (!/^[a-zA-Z0-9._]+$/.test(value))
    return "Handles can only contain letters, numbers, periods, and underscores"
  return null
}

function getInitials(name: string | null, handle: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
  }
  return handle.slice(0, 2).toUpperCase()
}

function formatLocation(loc: ArtistLocation): string {
  const parts = [loc.city, loc.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : loc.locationName
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AddArtistPage() {
  const router = useRouter()
  const { kick: startBioQueue } = useBioQueue()
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [handle, setHandle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>("idle")
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<ArtistResult | null>(null)

  // -- Instagram search
  const { cookie, save: saveCookie, clear: clearCookie } = useInstagramCookie()
  const [cookieDraft, setCookieDraft] = useState("")
  const [results, setResults] = useState<SearchUser[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchPaused, setSearchPaused] = useState(false)
  // Server-side search (paid provider) works without the user's cookie
  const [providerSearch, setProviderSearch] = useState(false)
  const canSearch = providerSearch || Boolean(cookie)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchCacheRef = useRef(new Map<string, SearchUser[]>())

  useEffect(() => {
    fetch("/api/instagram/search")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setProviderSearch(data?.provider === true))
      .catch(() => {})
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      searchAbortRef.current?.abort()
    }
  }, [])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function reset() {
    setHandle("")
    setError(null)
    setResult(null)
    setResults([])
    setOpen(false)
    setView("idle")
    setStep(0)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  /* ---------------------------------------------------------------- */
  /*  Search-as-you-type                                                */
  /* ---------------------------------------------------------------- */

  function cancelPendingSearch() {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = null
    searchAbortRef.current?.abort()
    searchAbortRef.current = null
  }

  function onHandleChange(raw: string) {
    const query = stripAt(raw)
    setHandle(query)
    if (error) setError(null)

    cancelPendingSearch()
    setActive(-1)

    if (!canSearch || searchPaused || query.length < SEARCH_MIN_CHARS) {
      setResults([])
      setSearching(false)
      setOpen(false)
      return
    }

    const cached = searchCacheRef.current.get(query.toLowerCase())
    if (cached) {
      setResults(cached)
      setSearching(false)
      setOpen(true)
      return
    }

    setSearching(true)
    setOpen(true)
    searchTimerRef.current = setTimeout(() => void runSearch(query), SEARCH_DEBOUNCE_MS)
  }

  async function runSearch(query: string) {
    const controller = new AbortController()
    searchAbortRef.current = controller

    try {
      const res = await fetch("/api/instagram/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, sessionId: cookie || undefined }),
        signal: controller.signal,
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setResults([])
        setOpen(false)
        if (data.code === "instagram_session") {
          clearCookie()
          setSearchError(data.error)
        } else if (res.status === 429) {
          // Stop searching for the rest of this visit
          setSearchPaused(true)
          setOpen(false)
          setSearchError(
            data.code === "search_limit"
              ? `${data.error} You can still type the full handle.`
              : "Search is rate limited right now. You can still type the full handle."
          )
        } else if (data.code === "search_unavailable") {
          setProviderSearch(false)
        } else {
          setSearchError("Search failed. You can still type the full handle.")
        }
        return
      }

      const users = data.users as SearchUser[]
      searchCacheRef.current.set(query.toLowerCase(), users)
      setResults(users)
      setSearchError(null)
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setOpen(false)
      setSearchError("Search failed. You can still type the full handle.")
    } finally {
      if (searchAbortRef.current === controller) {
        searchAbortRef.current = null
        setSearching(false)
      }
    }
  }

  function selectUser(user: SearchUser) {
    cancelPendingSearch()
    setOpen(false)
    setHandle(user.username)
    void addHandle(user.username, user)
  }

  function onHandleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "Escape") setOpen(false)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault()
      selectUser(results[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Add                                                               */
  /* ---------------------------------------------------------------- */

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    cancelPendingSearch()
    setOpen(false)
    void addHandle(stripAt(handle))
  }

  async function addHandle(cleaned: string, known?: SearchUser) {
    setHandle(cleaned)

    const validationError = validateHandle(cleaned)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setView("loading")
    setStep(0)

    // Advance the step indicator while the API works
    timerRef.current = setInterval(() => {
      setStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1
        clearTimer()
        return prev
      })
    }, STEP_ADVANCE_MS)

    try {
      const res = await fetch("/api/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Name + picture from search fill in the card until the bio is fetched
        body: JSON.stringify({
          handle: cleaned,
          fullName: known?.fullName ?? undefined,
          profilePicUrl: known?.profilePicUrl ?? undefined,
        }),
      })

      clearTimer()

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.")
        setView("idle")
        return
      }

      // Saved but the bio couldn't be fetched yet — let the queue retry it
      if ((data as ArtistResult).artist.fetchStatus === "pending") startBioQueue()

      // Flash all steps as complete before showing result
      setStep(STEPS.length)
      await new Promise((r) => setTimeout(r, DONE_PAUSE_MS))

      setResult(data as ArtistResult)
      setView("success")
    } catch {
      clearTimer()
      setError("Network error — check your connection and try again")
      setView("idle")
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-lg pt-2 sm:pt-8">
      {/* Back link */}
      <Link
        href="/artists"
        className="group/back mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover/back:-translate-x-0.5" />
        Artists
      </Link>

      {/* ---------------------------------------------------------- */}
      {/*  Success view                                               */}
      {/* ---------------------------------------------------------- */}
      {view === "success" && result ? (
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-guest-400/15">
                <Check className="h-3 w-3 text-guest-600" />
              </span>
              <CardTitle>
                {result.status === "existing"
                  ? "Already tracked"
                  : "Artist added"}
              </CardTitle>
            </div>
            {result.status === "existing" && (
              <CardDescription>
                This artist was already in your collection
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="grid gap-5">
            {/* Artist profile */}
            <div className="flex items-center gap-3.5">
              <Avatar className="size-14 text-lg">
                {result.artist.profilePicUrl && (
                  <AvatarImage
                    src={result.artist.profilePicUrl}
                    alt={
                      result.artist.displayName ||
                      result.artist.instagramHandle
                    }
                  />
                )}
                <AvatarFallback className="text-base">
                  {getInitials(
                    result.artist.displayName,
                    result.artist.instagramHandle
                  )}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium leading-snug">
                  {result.artist.displayName ||
                    result.artist.instagramHandle}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{result.artist.instagramHandle}
                </p>
              </div>
            </div>

            {/* Locations */}
            {result.artist.locations.length > 0 && (
              <div className="grid gap-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Locations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.artist.locations.map((loc) => (
                    <Badge
                      key={loc.id}
                      variant="secondary"
                      className={
                        loc.isPrimary
                          ? "border border-brand-500/30 bg-brand-500/10 text-brand-700"
                          : ""
                      }
                    >
                      {formatLocation(loc)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 &&
              result.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg bg-brand-500/10 px-4 py-3 text-sm text-brand-700"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <span>{warning}</span>
                </div>
              ))}
          </CardContent>

          <CardFooter className="gap-3">
            <Button variant="outline" onClick={reset}>
              <Plus className="h-3.5 w-3.5" />
              Add another
            </Button>
            <Button
              className="ml-auto"
              nativeButton={false}
              render={<Link href="/artists" />}
            >
              View artists
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        </Card>
      ) : view === "loading" ? (
        /* -------------------------------------------------------- */
        /*  Loading view                                             */
        /* -------------------------------------------------------- */
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <CardTitle>
              Adding @{handle}
            </CardTitle>
            <CardDescription>
              This usually takes a few seconds
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ol className="grid gap-0" aria-label="Pipeline progress">
              {STEPS.map((label, i) => {
                const done = i < step
                const active = i === step
                const last = i === STEPS.length - 1

                return (
                  <li key={label} className="flex gap-3">
                    {/* Step indicator + connector */}
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 items-center justify-center">
                        {done ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-guest-400/15">
                            <Check className="h-3 w-3 text-guest-600" />
                          </span>
                        ) : active ? (
                          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                        ) : (
                          <Circle className="h-2.5 w-2.5 fill-muted-foreground/20 text-muted-foreground/30" />
                        )}
                      </span>
                      {!last && (
                        <span
                          aria-hidden
                          className={`my-1 h-4 w-px ${
                            done ? "bg-guest-400/40" : "bg-border"
                          }`}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`pt-0.5 text-sm leading-6 ${
                        done
                          ? "text-muted-foreground"
                          : active
                            ? "font-medium text-foreground"
                            : "text-muted-foreground/40"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      ) : (
        /* -------------------------------------------------------- */
        /*  Form view (idle / error)                                 */
        /* -------------------------------------------------------- */
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Add Artist
            </CardTitle>
            <CardDescription>
              {canSearch
                ? "Search Instagram for a tattoo artist, or type their exact handle"
                : "Enter a tattoo artist\u2019s Instagram handle"}
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="handle">Instagram handle</Label>
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50 select-none"
                  >
                    @
                  </span>
                  <Input
                    ref={inputRef}
                    id="handle"
                    type="text"
                    placeholder={canSearch ? "Search artists…" : "artist_handle"}
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="handle-results"
                    aria-autocomplete="list"
                    aria-activedescendant={
                      active >= 0 ? `handle-option-${active}` : undefined
                    }
                    value={handle}
                    onChange={(e) => onHandleChange(e.target.value)}
                    onKeyDown={onHandleKeyDown}
                    onFocus={() => {
                      if (results.length > 0) setOpen(true)
                    }}
                    onBlur={() => setOpen(false)}
                    className="pl-7 pr-8"
                  />
                  {searching && (
                    <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}

                  {/* Results dropdown */}
                  {open && (results.length > 0 || !searching) && (
                    <div
                      id="handle-results"
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-border/50 bg-background/80 py-1 shadow-2xl shadow-black/25 backdrop-blur-xl backdrop-saturate-150"
                    >
                      {results.length === 0 ? (
                        <p className="px-3 py-2.5 text-sm text-muted-foreground">
                          No accounts found. Press Enter to add @{handle}.
                        </p>
                      ) : (
                        results.map((user, i) => (
                          <button
                            key={user.username}
                            id={`handle-option-${i}`}
                            type="button"
                            role="option"
                            aria-selected={i === active}
                            // Keep focus in the input so blur doesn't close the list first
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => selectUser(user)}
                            onMouseEnter={() => setActive(i)}
                            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                              i === active ? "bg-brand-500/10" : "hover:bg-muted/50"
                            }`}
                          >
                            <Avatar className="size-9">
                              {user.profilePicUrl && (
                                <AvatarImage
                                  src={user.profilePicUrl}
                                  alt=""
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <AvatarFallback className="text-xs">
                                {getInitials(user.fullName, user.username)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1 text-sm font-medium">
                                <span className="truncate">{user.username}</span>
                                {user.isVerified && (
                                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-guest-600" />
                                )}
                              </p>
                              {(user.fullName || user.isPrivate) && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {[user.fullName, user.isPrivate && "Private"]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              )}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {searchError ? (
                  <p className="text-xs text-brand-700/90">{searchError}</p>
                ) : (
                  cookie && (
                    <p className="text-xs text-muted-foreground">
                      Instagram connected in this browser.{" "}
                      <button
                        type="button"
                        onClick={() => {
                          clearCookie()
                          setResults([])
                          setOpen(false)
                        }}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Disconnect
                      </button>
                    </p>
                  )
                )}
              </div>

              <Button type="submit" className="w-full">
                Add Artist
              </Button>
            </form>

            {/* Connect Instagram (only needed when there's no server-side search) */}
            {!cookie && !providerSearch && (
              <div className="grid gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Search className="h-3.5 w-3.5 text-brand-600" />
                  Search Instagram as you type
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Paste your Instagram{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                    sessionid
                  </code>{" "}
                  cookie (instagram.com → F12 → Application → Cookies). It&apos;s
                  only used for search, and is remembered in this browser only.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveCookie(cookieDraft)
                    setCookieDraft("")
                    setSearchError(null)
                    setSearchPaused(false)
                    inputRef.current?.focus()
                  }}
                  className="flex gap-2"
                >
                  <Input
                    type="password"
                    aria-label="Instagram sessionid cookie"
                    placeholder="Paste sessionid value…"
                    autoComplete="off"
                    value={cookieDraft}
                    onChange={(e) => setCookieDraft(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={!cookieDraft.trim()}
                  >
                    Connect
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
