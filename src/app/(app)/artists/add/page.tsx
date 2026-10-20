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
import { useCurrentUserId } from "@/hooks/use-current-user-id"
import { useDebouncedSearch } from "@/hooks/use-debounced-search"
import { useInstagramCookie } from "@/hooks/use-instagram-cookie"
import type { DirectoryArtist } from "@/lib/artist-directory"
import { looksLikeLink, parseHandleInput, parseProfileLink } from "@/lib/instagram-handle"

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

/** A row in the suggestions list */
type Suggestion =
  | { kind: "own"; artist: DirectoryArtist }
  | { kind: "directory"; artist: DirectoryArtist }
  | { kind: "instagram"; user: SearchUser }
  | { kind: "add"; handle: string }

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

// travel-ink search is a cheap database query
const DIRECTORY_DEBOUNCE_MS = 200
// Each Instagram search is a request with the user's cookie — keep them sparse
const INSTAGRAM_DEBOUNCE_MS = 400
const SEARCH_MIN_CHARS = 2
const SEARCH_MAX_CHARS = 60

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** What to search for: the handle in a profile link, or the typed text. Null if there's nothing to search. */
function searchTermFor(input: string): string | null {
  const text = input.trim()
  let term: string
  if (looksLikeLink(text)) {
    const link = parseProfileLink(text)
    if (!link.ok) return null
    term = link.handle
  } else {
    term = text.replace(/^@+/, "").replace(/\s+/g, " ").trim().toLowerCase()
  }
  return term.length >= SEARCH_MIN_CHARS && term.length <= SEARCH_MAX_CHARS ? term : null
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

function formatPlace(city: string | null, country: string | null): string | null {
  return [city, country].filter(Boolean).join(", ") || null
}

function SuggestionGroup({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="border-t border-border/50 py-1 first:border-t-0"
    >
      <div
        id={id}
        role="presentation"
        className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80"
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function SuggestionContent({ suggestion }: { suggestion: Suggestion }) {
  switch (suggestion.kind) {
    case "own":
    case "directory": {
      const { artist } = suggestion
      const details = [artist.displayName, formatPlace(artist.city, artist.country)]
        .filter(Boolean)
        .join(" · ")
      return (
        <>
          <Avatar className="size-9">
            {artist.profilePicUrl && (
              <AvatarImage src={artist.profilePicUrl} alt="" referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="text-xs">
              {getInitials(artist.displayName, artist.instagramHandle)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{artist.instagramHandle}</p>
            {details && <p className="truncate text-xs text-muted-foreground">{details}</p>}
          </div>
          {/* Your own artists open; other users' are added to your list */}
          {suggestion.kind === "own" ? (
            <ArrowRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Plus aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </>
      )
    }
    case "instagram": {
      const { user } = suggestion
      return (
        <>
          <Avatar className="size-9">
            {user.profilePicUrl && (
              <AvatarImage src={user.profilePicUrl} alt="" referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="text-xs">
              {getInitials(user.fullName, user.username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-sm font-medium">
              <span className="truncate">{user.username}</span>
              {user.isVerified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />
              )}
            </p>
            {(user.fullName || user.isPrivate) && (
              <p className="truncate text-xs text-muted-foreground">
                {[user.fullName, user.isPrivate && "Private"].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <Plus aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </>
      )
    }
    case "add":
      return (
        <>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10">
            <Plus aria-hidden className="h-4 w-4 text-brand-400" />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="text-muted-foreground">Not here?</span>{" "}
            <span className="font-medium">Add @{suggestion.handle}</span>
          </p>
        </>
      )
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AddArtistPage() {
  const router = useRouter()
  const { kick: startBioQueue } = useBioQueue()
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // What's typed in the field: a name or handle to search for, or a profile link
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>("idle")
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<ArtistResult | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  // -- travel-ink search: the user's own artists, then ones other users added
  const directory = useDebouncedSearch<DirectoryArtist[]>(async (query, signal) => {
    const res = await fetch(`/api/artists/directory?q=${encodeURIComponent(query)}`, { signal })
    if (res.status === 401) {
      router.push("/login")
      return null
    }
    if (!res.ok) return null
    const data = (await res.json()) as { artists: DirectoryArtist[] }
    return data.artists
  }, DIRECTORY_DEBOUNCE_MS)

  // -- Instagram search (optional, through the user's own cookie)
  const userId = useCurrentUserId()
  const { cookie, save: saveCookie, clear: clearCookie } = useInstagramCookie()
  const [cookieDraft, setCookieDraft] = useState("")
  // Why Instagram search stopped (session rejected or rate limited). Unlike a
  // failed search, it stays until Instagram is connected again
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchPaused, setSearchPaused] = useState(false)
  const instagram = useDebouncedSearch<SearchUser[]>(async (query, signal) => {
    const res = await fetch("/api/instagram/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, sessionId: cookie, ownerId: userId }),
      signal,
    })

    if (res.status === 401) {
      router.push("/login")
      return null
    }

    const data = await res.json()

    if (!res.ok) {
      if (data.code === "instagram_session") {
        clearCookie()
        setSearchError(data.error)
      } else if (res.status === 429) {
        // Stop searching Instagram for the rest of this visit
        setSearchPaused(true)
        setSearchError("Instagram search is rate limited right now. You can still type the full handle.")
      }
      return null
    }

    return data.users as SearchUser[]
  }, INSTAGRAM_DEBOUNCE_MS)

  // -- Suggestions, in display order
  const term = searchTermFor(input)
  const found = directory.results ?? []
  const own = found.filter((a) => a.onList)
  const others = found.filter((a) => !a.onList)
  const shownHandles = new Set(found.map((a) => a.instagramHandle))
  const fromInstagram = cookie
    ? (instagram.results ?? []).filter((u) => !shownHandles.has(u.username.toLowerCase()))
    : []
  for (const user of fromInstagram) shownHandles.add(user.username.toLowerCase())
  const instagramNotice =
    searchError ??
    (cookie && instagram.failed
      ? "Instagram search failed. You can still type the full handle."
      : null)
  const entered = parseHandleInput(input)
  const addable = entered.ok && !shownHandles.has(entered.handle) ? entered.handle : null
  const suggestions: Suggestion[] = [
    ...own.map((artist) => ({ kind: "own" as const, artist })),
    ...others.map((artist) => ({ kind: "directory" as const, artist })),
    ...fromInstagram.map((user) => ({ kind: "instagram" as const, user })),
    ...(addable ? [{ kind: "add" as const, handle: addable }] : []),
  ]
  // Wait for travel-ink's results, so the list doesn't jump when they arrive
  const showList =
    open &&
    term !== null &&
    (directory.results !== null || (!directory.loading && suggestions.length > 0))
  const activeIndex = showList && active < suggestions.length ? active : -1

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function reset() {
    setInput("")
    setError(null)
    setResult(null)
    // Adding an artist changes which results are on the user's list
    directory.reset()
    instagram.clear()
    setOpen(false)
    setActive(-1)
    setView("idle")
    setStep(0)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  /* ---------------------------------------------------------------- */
  /*  Search-as-you-type                                                */
  /* ---------------------------------------------------------------- */

  function stopSearches() {
    directory.cancel()
    instagram.cancel()
  }

  function onInputChange(raw: string) {
    let value = raw
    let pasteError: string | null = null
    // A pasted profile link becomes its handle (a typed one stays as typed)
    if (value.length > input.length + 1 && looksLikeLink(value)) {
      const link = parseProfileLink(value)
      if (link.ok) value = link.handle
      else pasteError = link.error
    }
    setInput(value)
    setError(pasteError)
    setActive(-1)
    setOpen(true)

    const query = searchTermFor(value)
    if (!query) {
      directory.clear()
      instagram.clear()
      return
    }
    directory.search(query)
    if (cookie && !searchPaused) instagram.search(query)
    else instagram.clear()
  }

  function selectSuggestion(suggestion: Suggestion) {
    stopSearches()
    setOpen(false)
    setActive(-1)
    switch (suggestion.kind) {
      case "own":
        router.push(`/artists/${suggestion.artist.id}`)
        break
      case "directory":
        void addHandle(suggestion.artist.instagramHandle)
        break
      case "instagram":
        void addHandle(suggestion.user.username, suggestion.user)
        break
      case "add":
        void addHandle(suggestion.handle)
        break
    }
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false)
      setActive(-1)
      return
    }
    if (e.key === "ArrowDown" && !open) {
      e.preventDefault()
      setOpen(true)
      return
    }
    if (!showList || suggestions.length === 0) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i <= 0 || i > suggestions.length ? suggestions.length - 1 : i - 1))
    } else if (e.key === "Enter" && activeIndex >= 0) {
      // Without a highlighted suggestion, Enter submits the typed handle
      e.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    }
  }

  /** The options of one kind, keeping their index in `suggestions` for keyboard navigation. */
  function renderSuggestions(kind: Suggestion["kind"]) {
    return suggestions.map((suggestion, i) =>
      suggestion.kind !== kind ? null : (
        <button
          key={
            suggestion.kind === "instagram"
              ? suggestion.user.username
              : suggestion.kind === "add"
                ? "add"
                : suggestion.artist.id
          }
          id={`handle-option-${i}`}
          type="button"
          role="option"
          aria-selected={i === activeIndex}
          // Keep focus in the input so blur doesn't close the list first
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => selectSuggestion(suggestion)}
          onMouseEnter={() => setActive(i)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
            i === activeIndex ? "bg-brand-500/10" : "hover:bg-muted/50"
          }`}
        >
          <SuggestionContent suggestion={suggestion} />
        </button>
      )
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Add                                                               */
  /* ---------------------------------------------------------------- */

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    stopSearches()
    setOpen(false)
    void addHandle(input)
  }

  /** Adds a handle, or the handle in a profile link. */
  async function addHandle(raw: string, known?: SearchUser) {
    const parsed = parseHandleInput(raw)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    const handle = parsed.handle
    setInput(handle)

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
          handle,
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
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-3 w-3 text-emerald-400" />
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
                          ? "border border-brand-500/30 bg-brand-500/10 text-brand-200"
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
                  className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
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
              Adding @{input}
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
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                            <Check className="h-3 w-3 text-emerald-400" />
                          </span>
                        ) : active ? (
                          <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                        ) : (
                          <Circle className="h-2.5 w-2.5 fill-muted-foreground/20 text-muted-foreground/30" />
                        )}
                      </span>
                      {!last && (
                        <span
                          aria-hidden
                          className={`my-1 h-4 w-px ${
                            done ? "bg-emerald-500/30" : "bg-border"
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
        // overflow-visible: the suggestions list may extend below the card
        <Card className="overflow-visible border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Add Artist
            </CardTitle>
            <CardDescription>
              Search for a tattoo artist, enter their Instagram handle, or
              paste a link to their profile
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
                <Label htmlFor="handle">Artist</Label>
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
                  />
                  <Input
                    ref={inputRef}
                    id="handle"
                    type="text"
                    placeholder="Name, @handle or profile link"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    role="combobox"
                    aria-expanded={showList}
                    aria-controls="handle-results"
                    aria-autocomplete="list"
                    aria-describedby="handle-help"
                    aria-activedescendant={
                      activeIndex >= 0 ? `handle-option-${activeIndex}` : undefined
                    }
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    className="pl-8 pr-8"
                  />
                  {(directory.loading || instagram.loading) && (
                    <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}

                  {/* Suggestions */}
                  {showList && (
                    <div
                      id="handle-results"
                      role="listbox"
                      aria-label="Suggestions"
                      className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-96 overflow-y-auto rounded-lg border border-border/50 bg-background/80 py-1 shadow-2xl shadow-black/25 backdrop-blur-xl backdrop-saturate-150"
                    >
                      {own.length > 0 && (
                        <SuggestionGroup id="handle-group-own" label="On your list">
                          {renderSuggestions("own")}
                        </SuggestionGroup>
                      )}
                      {directory.results !== null && (
                        <SuggestionGroup
                          id="handle-group-directory"
                          label="Added by other travel-ink users"
                        >
                          {others.length > 0 ? (
                            renderSuggestions("directory")
                          ) : (
                            <p className="px-3 py-1.5 text-sm text-muted-foreground">
                              No matches
                            </p>
                          )}
                        </SuggestionGroup>
                      )}
                      {fromInstagram.length > 0 && (
                        <SuggestionGroup id="handle-group-instagram" label="From Instagram">
                          {renderSuggestions("instagram")}
                        </SuggestionGroup>
                      )}
                      {addable && (
                        <div
                          role="none"
                          className="border-t border-border/50 pt-1 first:border-t-0"
                        >
                          {renderSuggestions("add")}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p id="handle-help" className="text-xs text-muted-foreground">
                  Searches artists other travel-ink users have already added
                  {cookie ? (
                    <>
                      , and Instagram (connected in this tab).{" "}
                      <button
                        type="button"
                        onClick={() => {
                          clearCookie()
                          instagram.clear()
                        }}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    "."
                  )}
                </p>
                <p className="hidden text-xs text-muted-foreground pointer-coarse:block">
                  On your phone? In the Instagram app, open the artist&apos;s
                  profile and tap ⋯ → Copy profile URL, then paste it here.
                </p>
                {directory.failed && (
                  <p className="text-xs text-amber-300/90">
                    Couldn&apos;t search travel-ink. You can still type the full handle.
                  </p>
                )}
                {instagramNotice && (
                  <p className="text-xs text-amber-300/90">{instagramNotice}</p>
                )}
              </div>

              <Button type="submit" className="w-full">
                Add Artist
              </Button>
            </form>

            {/* Connect Instagram */}
            {!cookie && (
              <div className="grid gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3.5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <Search className="h-3.5 w-3.5 text-brand-300" />
                  Search all of Instagram too
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Paste your Instagram{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                    sessionid
                  </code>{" "}
                  cookie (instagram.com → F12 → Application → Cookies). It&apos;s
                  used for search and importing your following list, and kept in
                  this tab until you reload or close it, or sign out.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveCookie(cookieDraft)
                    setCookieDraft("")
                    setSearchError(null)
                    setSearchPaused(false)
                    if (term) instagram.search(term)
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
