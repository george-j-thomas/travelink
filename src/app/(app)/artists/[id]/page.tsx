"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Plane,
  Trash2,
  Map,
  Loader2,
  AlertCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

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
  locations: ArtistLocation[]
}

const MISSING_BIO_TEXT: Record<Artist["fetchStatus"], string> = {
  pending: "Bio not fetched yet — it will be filled in automatically.",
  fetched: "No bio available",
  unavailable:
    "Instagram only shares bios of public Business/Creator accounts, and this isn't one. Add a location below.",
  failed: "Couldn't fetch this bio. Add a location below, or re-add the artist to try again.",
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

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

function accountTypeLabel(type: string): string {
  switch (type.toLowerCase()) {
    case "business":
      return "Business"
    case "creator":
      return "Creator"
    case "personal":
      return "Personal"
    default:
      return "Unknown"
  }
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

/* ═══════════════════════════════════════════════════════════════════════
   Skeleton (loading placeholder)
   ═══════════════════════════════════════════════════════════════════ */

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Back link */}
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />

      {/* Profile card */}
      <Card>
        <CardContent className="animate-pulse">
          <div className="flex items-start gap-5">
            <div className="size-20 shrink-0 rounded-full bg-muted" />
            <div className="min-w-0 flex-1 space-y-3 pt-1">
              <div className="h-7 w-48 rounded bg-muted" />
              <div className="h-4 w-36 rounded bg-muted" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
          </div>
          <Separator className="my-4" />
          <div className="h-7 w-40 rounded bg-muted" />
        </CardContent>
      </Card>

      {/* Bio */}
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-14 rounded bg-muted" />
        <Card>
          <CardContent>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted" />
              <div className="h-4 w-3/5 rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations */}
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-4 w-28 rounded bg-muted" />
        </div>
        {Array.from({ length: 2 }, (_, i) => (
          <Card size="sm" key={i}>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="size-8 shrink-0 rounded-lg bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-muted" />
                  <div className="h-3 w-28 rounded bg-muted" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-muted" />
                    <div className="h-5 w-20 rounded-full bg-muted" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Location card
   ═══════════════════════════════════════════════════════════════════ */

function LocationCard({ location }: { location: ArtistLocation }) {
  const dates = formatDateRange(location.startDate, location.endDate)

  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
            {location.isGuestSpot ? (
              <Plane className="size-4 text-brand-500" />
            ) : (
              <MapPin className="size-4 text-brand-500" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-medium text-foreground">
              {locationLabel(location)}
            </p>

            {location.lat != null && location.lng != null && (
              <p className="mt-0.5 text-xs text-muted-foreground/60">
                {formatCoords(location.lat, location.lng)}
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              {location.isPrimary && (
                <Badge
                  variant="secondary"
                  className="border border-brand-500/20 bg-brand-500/10 text-brand-600"
                >
                  Primary
                </Badge>
              )}

              {location.isGuestSpot && (
                <Badge
                  variant="secondary"
                  className="border border-guest-500/20 bg-guest-500/10 text-guest-500"
                >
                  Guest Spot
                </Badge>
              )}

              {dates && (
                <Badge
                  variant="outline"
                  className="font-normal text-muted-foreground"
                >
                  {dates}
                </Badge>
              )}

              <Badge
                variant="ghost"
                className="text-muted-foreground/50"
              >
                {location.source === "bio" ? "From bio" : "Manual"}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Error state
   ═══════════════════════════════════════════════════════════════════ */

function NotFoundState() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
          <AlertCircle
            className="size-8 text-destructive"
            strokeWidth={1.5}
          />
        </div>

        <h2 className="text-lg font-medium text-foreground">
          Artist not found
        </h2>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
          This artist may have been removed, or the link might be incorrect.
        </p>

        <Link href="/artists" className="mt-6">
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-3.5" />
            Back to Artists
          </Button>
        </Link>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════ */

export default function ArtistDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const [artist, setArtist] = useState<Artist | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchArtist = useCallback(() => {
    if (!params.id) return
    setLoading(true)
    setError(false)
    fetch(`/api/artists/${params.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch artist")
        return res.json()
      })
      .then((data: Artist) => setArtist(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    fetchArtist()
  }, [fetchArtist])

  function handleDelete() {
    if (!artist) return
    setDeleting(true)
    fetch(`/api/artists/${artist.id}`, { method: "DELETE" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to delete")
        router.push("/artists")
      })
      .catch(() => {
        setDeleting(false)
      })
  }

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) return <DetailSkeleton />

  /* ── Error / not found ────────────────────────────────────── */
  if (error || !artist) return <NotFoundState />

  /* ── Derived data ─────────────────────────────────────────── */
  const name = artist.displayName || artist.instagramHandle
  const initials = artist.displayName
    ? getInitials(artist.displayName)
    : artist.instagramHandle.slice(0, 2).toUpperCase()

  const primaryLocs = artist.locations.filter((l) => l.isPrimary)
  const guestSpots = artist.locations.filter((l) => l.isGuestSpot)
  const otherLocs = artist.locations.filter(
    (l) => !l.isPrimary && !l.isGuestSpot,
  )
  const sortedLocations = [...primaryLocs, ...guestSpots, ...otherLocs]

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* ── Back link ─────────────────────────────────────────── */}
      <Link
        href="/artists"
        className="group/back inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover/back:-translate-x-0.5" />
        Back to Artists
      </Link>

      {/* ── Profile card ──────────────────────────────────────── */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-5">
            <Avatar className="size-20 ring-2 ring-brand-500/20">
              {artist.profilePicUrl && (
                <AvatarImage src={artist.profilePicUrl} alt="" />
              )}
              <AvatarFallback className="bg-brand-500/15 text-xl font-semibold text-brand-500">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="font-display text-2xl tracking-tight text-chrome">
                {name}
              </h1>

              <a
                href={`https://instagram.com/${artist.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group/ig inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-brand-500"
              >
                @{artist.instagramHandle}
                <ExternalLink className="size-3 opacity-0 transition-opacity group-hover/ig:opacity-100" />
              </a>

              <div>
                <Badge variant="outline" className="text-muted-foreground">
                  {accountTypeLabel(artist.accountType)}
                </Badge>
              </div>
            </div>
          </div>

          <Separator className="my-4" />

          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger
              render={<Button variant="destructive" size="sm" />}
            >
              <Trash2 className="size-3.5" />
              Remove from my list
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove artist?</DialogTitle>
                <DialogDescription>
                  This will remove{" "}
                  <strong className="text-foreground">
                    @{artist.instagramHandle}
                  </strong>{" "}
                  from your list. The artist&apos;s data will be preserved for
                  other users.
                </DialogDescription>
              </DialogHeader>

              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>
                  Cancel
                </DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  {deleting ? "Removing…" : "Yes, remove"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* ── Bio section ───────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          About
        </h2>

        <Card>
          <CardContent>
            {artist.bio ? (
              <p className="whitespace-pre-line leading-relaxed text-foreground/90">
                {artist.bio}
              </p>
            ) : (
              <p
                className="italic text-muted-foreground"
                title={artist.fetchStatus === "failed" ? artist.fetchError ?? undefined : undefined}
              >
                {MISSING_BIO_TEXT[artist.fetchStatus] ?? MISSING_BIO_TEXT.fetched}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Locations section ─────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Locations
            {artist.locations.length > 0 && (
              <span className="ml-1.5 text-muted-foreground/50">
                ({artist.locations.length})
              </span>
            )}
          </h2>

          <Link
            href={`/artists/${artist.id}/locations`}
            className="text-sm text-brand-500 transition-colors hover:text-brand-600"
          >
            Edit locations
          </Link>
        </div>

        {sortedLocations.length > 0 ? (
          <div className="space-y-3">
            {sortedLocations.map((loc) => (
              <LocationCard key={loc.id} location={loc} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent>
              <div className="flex flex-col items-center py-6 text-center">
                <MapPin
                  className="mb-3 size-8 text-muted-foreground/30"
                  strokeWidth={1.5}
                />
                <p className="text-sm text-muted-foreground">
                  No locations found.
                </p>
                <Link
                  href={`/artists/${artist.id}/locations`}
                  className="mt-2 text-sm text-brand-500 transition-colors hover:text-brand-600"
                >
                  Add locations manually →
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ── Map placeholder ───────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Map
        </h2>

        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-foreground/10 bg-card/50">
          <div className="flex flex-col items-center text-center">
            <Map
              className="mb-2 size-8 text-muted-foreground/30"
              strokeWidth={1.5}
            />
            <p className="text-sm text-muted-foreground/50">
              Map view coming soon
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
