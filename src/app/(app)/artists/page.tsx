"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  Search,
  Plus,
  Upload,
  MapPin,
  Plane,
  UserRound,
  RefreshCw,
  Clock,
  EyeOff,
  AlertCircle,
  Loader2,
  PauseCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { OnboardingGuide } from "@/components/onboarding-guide"
import {
  formatResumeTime,
  useBioQueue,
  type BioQueueState,
} from "@/components/bio-queue"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

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

interface Artist {
  id: string
  instagramHandle: string
  displayName: string | null
  bio: string | null
  profilePicUrl: string | null
  accountType: string
  fetchStatus: "pending" | "fetched" | "unavailable" | "failed"
  fetchError: string | null
  notes: string | null
  updatedAt?: string
  locations: ArtistLocation[]
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "just now"
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatDateRange(
  start: string | null,
  end: string | null,
): string | null {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  if (start) return `from ${fmt(start)}`
  if (end) return `until ${fmt(end)}`
  return null
}

function locationLabel(loc: ArtistLocation): string {
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`
  return loc.city || loc.country || loc.locationName
}

/* ═══════════════════════════════════════════════════════════════════════
   Skeleton card (loading placeholder)
   ═══════════════════════════════════════════════════════════════════ */

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="animate-pulse">
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/5 rounded bg-muted" />
            <div className="h-3.5 w-2/5 rounded bg-muted" />
          </div>
        </div>
        <Separator className="my-3" />
        <div className="flex gap-2">
          <div className="h-5 w-28 rounded-full bg-muted" />
          <div className="h-5 w-20 rounded-full bg-muted" />
        </div>
      </CardContent>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════════ */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
        <UserRound className="size-10 text-amber-500/80" strokeWidth={1.5} />
      </div>

      <h2 className="text-lg font-medium text-foreground">No artists yet</h2>
      <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        Import your Instagram following list to automatically add the tattoo
        artists you follow.
      </p>

      <Link href="/artists/import" className="mt-6">
        <Button
          className="bg-amber-500 font-medium text-black hover:bg-amber-400"
          size="lg"
        >
          <Upload className="size-4" />
          Import Your Artists
        </Button>
      </Link>
      <Link
        href="/artists/add"
        className="mt-3 text-sm text-muted-foreground hover:text-amber-500 transition-colors"
      >
        or add one manually
      </Link>

      <div className="mt-8">
        <OnboardingGuide />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Artist card
   ═══════════════════════════════════════════════════════════════════ */

function ArtistCard({ artist }: { artist: Artist }) {
  const name = artist.displayName || artist.instagramHandle
  const initials = artist.displayName
    ? getInitials(artist.displayName)
    : artist.instagramHandle.slice(0, 2).toUpperCase()

  const primary = artist.locations.find((l) => l.isPrimary)
  const guestSpots = artist.locations.filter((l) => l.isGuestSpot)
  const hasLocations = primary || guestSpots.length > 0

  return (
    <Link
      href={`/artists/${artist.id}`}
      aria-label={`View ${name} (@${artist.instagramHandle})`}
      className="group/card-link block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="h-full transition-shadow duration-200 group-hover/card-link:ring-amber-500/25">
        <CardContent>
          {/* ── Identity ── */}
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {artist.profilePicUrl && (
                <AvatarImage src={artist.profilePicUrl} alt="" />
              )}
              <AvatarFallback className="bg-amber-500/15 text-base font-semibold text-amber-500">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium leading-snug text-foreground">
                {name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                @{artist.instagramHandle}
              </p>
            </div>
          </div>

          {/* ── Bio status ── */}
          {artist.fetchStatus !== "fetched" && !hasLocations && (
            <>
              <Separator className="my-3" />
              <FetchStatusBadge artist={artist} />
            </>
          )}

          {/* ── Location badges ── */}
          {hasLocations && (
            <>
              <Separator className="my-3" />
              <div className="flex flex-wrap gap-1.5">
                {primary && (
                  <Badge
                    variant="secondary"
                    className="gap-1 border border-amber-500/20 bg-amber-500/10 text-amber-400"
                  >
                    <MapPin className="size-3" />
                    {locationLabel(primary)}
                  </Badge>
                )}

                {guestSpots.map((gs) => {
                  const dates = formatDateRange(gs.startDate, gs.endDate)
                  return (
                    <Badge
                      key={gs.id}
                      variant="outline"
                      className="gap-1 font-normal text-muted-foreground"
                    >
                      <Plane className="size-3" />
                      <span>{locationLabel(gs)}</span>
                      {dates && (
                        <span className="text-muted-foreground/50">
                          · {dates}
                        </span>
                      )}
                    </Badge>
                  )
                })}
              </div>
            </>
          )}

          {/* ── Updated timestamp ── */}
          {artist.updatedAt && (
            <p className="mt-3 text-right text-xs text-muted-foreground/50">
              Updated {timeAgo(artist.updatedAt)}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Bio fetch status
   ═══════════════════════════════════════════════════════════════════ */

function FetchStatusBadge({ artist }: { artist: Artist }) {
  if (artist.fetchStatus === "pending") {
    return (
      <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
        <Clock className="size-3" />
        Waiting for bio
      </Badge>
    )
  }
  if (artist.fetchStatus === "unavailable") {
    return (
      <Badge
        variant="outline"
        className="gap-1 font-normal text-muted-foreground"
        title="Instagram only shares bios of public Business/Creator accounts. Add a location manually."
      >
        <EyeOff className="size-3" />
        No public bio · add location
      </Badge>
    )
  }
  return (
    <Badge
      variant="outline"
      className="gap-1 border-destructive/30 font-normal text-destructive"
      title={artist.fetchError ?? undefined}
    >
      <AlertCircle className="size-3" />
      Bio fetch failed · add location
    </Badge>
  )
}

function QueueBanner({ queue, pending }: { queue: BioQueueState; pending: number }) {
  const remaining = queue.status === "idle" ? pending : queue.remaining
  if (remaining === 0 && queue.status !== "error") return null

  let icon = <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-amber-500" />
  let text: React.ReactNode

  switch (queue.status) {
    case "running":
      text = (
        <>
          Fetching bios for <strong className="font-medium text-foreground">{remaining}</strong>{" "}
          {remaining === 1 ? "artist" : "artists"}. They&apos;re already saved, so you can leave
          this page and it picks up where it left off.
          {queue.currentHandle && <> Last: @{queue.currentHandle}</>}
        </>
      )
      break
    case "paused":
      icon = <PauseCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
      text = (
        <>
          Instagram&apos;s hourly lookup limit was reached. {remaining === 1 ? "1 bio" : `${remaining} bios`} will resume
          {queue.pausedUntil ? ` at ${formatResumeTime(queue.pausedUntil)}` : " shortly"}. Your
          artists are saved.
        </>
      )
      break
    case "not_configured":
      icon = <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
      text = (
        <>
          {remaining} {remaining === 1 ? "artist is" : "artists are"} saved and waiting for
          {remaining === 1 ? " its bio" : " their bios"}. {queue.message} Once it is, they&apos;ll
          be fetched automatically.
        </>
      )
      break
    case "error":
      icon = <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      text = queue.message
      break
    default:
      icon = <Clock className="mt-0.5 size-4 shrink-0 text-amber-500" />
      text = <>{remaining} {remaining === 1 ? "artist is" : "artists are"} waiting for a bio.</>
  }

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ${
        queue.status === "error"
          ? "bg-destructive/10 text-destructive"
          : "border border-amber-500/20 bg-amber-500/5 text-muted-foreground"
      }`}
    >
      {icon}
      <span>{text}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════ */

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState("")
  const { state: queue, kick, onArtistFetched } = useBioQueue()
  // Bios that arrive while the list is still loading would otherwise be overwritten by it
  const fetchedRef = useRef(new Map<string, Artist>())

  const fetchArtists = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch("/api/artists")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch artists")
        return res.json()
      })
      .then((data: Artist[]) =>
        setArtists(
          data.map((a) =>
            a.fetchStatus === "pending" ? (fetchedRef.current.get(a.id) ?? a) : a
          )
        )
      )
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchArtists()
  }, [fetchArtists])

  // Swap in each artist as its bio arrives
  useEffect(
    () =>
      onArtistFetched((updated) => {
        fetchedRef.current.set(updated.id, updated as unknown as Artist)
        setArtists((prev) =>
          prev.map((a) => (a.id === updated.id ? (updated as unknown as Artist) : a))
        )
      }),
    [onArtistFetched]
  )

  const pendingCount = useMemo(
    () => artists.filter((a) => a.fetchStatus === "pending").length,
    [artists]
  )

  // Artists may have been added since the queue last ran (e.g. in another tab).
  // kick() is a no-op while the queue is already running.
  const hasPending = pendingCount > 0
  useEffect(() => {
    if (hasPending) kick()
  }, [hasPending, kick])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return artists
    return artists.filter(
      (a) =>
        a.instagramHandle.toLowerCase().includes(q) ||
        a.displayName?.toLowerCase().includes(q) ||
        a.locations.some(
          (l) =>
            l.city?.toLowerCase().includes(q) ||
            l.country?.toLowerCase().includes(q) ||
            l.locationName.toLowerCase().includes(q),
        ),
    )
  }, [artists, search])

  /* Show search + add controls when loading (skeleton state) or when
     artists exist. Hidden in empty / error states where dedicated CTAs
     take over. */
  const showControls = loading || artists.length > 0

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your Artists
          {!loading && artists.length > 0 && (
            <span className="ml-2 align-baseline text-base font-normal text-muted-foreground">
              ({artists.length})
            </span>
          )}
        </h1>

        {showControls && (
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search artists…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                aria-label="Search artists"
              />
            </div>

            <Link href="/artists/add" className="shrink-0">
              <Button variant="outline" size="sm">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add Artist</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </Link>

            <Link href="/artists/import" className="shrink-0">
              <Button className="bg-amber-500 font-medium text-black hover:bg-amber-400">
                <Upload className="size-4" />
                <span className="hidden sm:inline">Import Artists</span>
                <span className="sm:hidden">Import</span>
              </Button>
            </Link>
          </div>
        )}
      </div>

      {!loading && !error && <QueueBanner queue={queue} pending={pendingCount} />}

      {/* ── Content ──────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-sm text-muted-foreground">
            Something went wrong loading your artists.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={fetchArtists}
          >
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      ) : artists.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Search
            className="mb-3 size-8 text-muted-foreground/30"
            strokeWidth={1.5}
          />
          <p className="text-sm text-muted-foreground">
            No artists match{" "}
            <span className="font-medium text-foreground">&ldquo;{search}&rdquo;</span>
          </p>
          <Button
            variant="link"
            size="sm"
            className="mt-1 text-amber-500 hover:text-amber-400"
            onClick={() => setSearch("")}
          >
            Clear search
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  )
}
