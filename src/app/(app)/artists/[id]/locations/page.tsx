"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  MapPin,
  Pencil,
  Plane,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { LocationForm } from "@/components/location-form"

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
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function locationLabel(loc: ArtistLocation): string {
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`
  return loc.city || loc.country || loc.locationName
}

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
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

/* ═══════════════════════════════════════════════════════════════════════
   Loading skeleton
   ═══════════════════════════════════════════════════════════════════ */

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card size="sm" key={i}>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="size-8 shrink-0 animate-pulse rounded-lg bg-muted" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-28 animate-pulse rounded bg-muted" />
                  <div className="flex gap-2">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
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
   Error state
   ═══════════════════════════════════════════════════════════════════ */

function ErrorState() {
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
   Location card (display mode)
   ═══════════════════════════════════════════════════════════════════ */

function LocationCardDisplay({
  location,
  onEdit,
  onDelete,
  isDeleting,
}: {
  location: ArtistLocation
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const dates = formatDateRange(location.startDate, location.endDate)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleConfirmDelete() {
    onDelete()
    setDeleteOpen(false)
  }

  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-start gap-3">
          {/* ── Icon ────────────────────────────────────────── */}
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
            {location.isGuestSpot ? (
              <Plane className="size-4 text-brand-500" />
            ) : (
              <MapPin className="size-4 text-brand-500" />
            )}
          </div>

          {/* ── Details ─────────────────────────────────────── */}
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
                  className="border border-brand-500/20 bg-brand-500/10 text-brand-400"
                >
                  Primary
                </Badge>
              )}

              {location.isGuestSpot && (
                <Badge
                  variant="secondary"
                  className="border border-guest-500/20 bg-guest-500/10 text-guest-400"
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

          {/* ── Actions ─────────────────────────────────────── */}
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onEdit}
              aria-label="Edit location"
            >
              <Pencil className="size-3" />
            </Button>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    disabled={isDeleting}
                    aria-label="Delete location"
                  />
                }
              >
                {isDeleting ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
              </DialogTrigger>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete location?</DialogTitle>
                  <DialogDescription>
                    This will permanently remove{" "}
                    <strong className="text-foreground">
                      {locationLabel(location)}
                    </strong>{" "}
                    from this artist&apos;s locations.
                  </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    Cancel
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmDelete}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Location card (edit mode — wraps LocationForm)
   ═══════════════════════════════════════════════════════════════════ */

function LocationCardEdit({
  location,
  artistId,
  onSuccess,
  onCancel,
}: {
  location: ArtistLocation
  artistId: string
  onSuccess: () => void
  onCancel: () => void
}) {
  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">
            Edit location
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <LocationForm
          artistId={artistId}
          location={location}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </CardContent>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════ */

export default function ArtistLocationsPage() {
  const params = useParams<{ id: string }>()

  const [artist, setArtist] = useState<Artist | null>(null)
  const [locations, setLocations] = useState<ArtistLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* ── Fetch ───────────────────────────────────────────────────── */
  const fetchData = useCallback(() => {
    if (!params.id) return
    setLoading(true)
    setError(false)

    Promise.all([
      fetch(`/api/artists/${params.id}`).then((r) => {
        if (!r.ok) throw new Error("artist")
        return r.json()
      }),
      fetch(`/api/artists/${params.id}/locations`).then((r) => {
        if (!r.ok) throw new Error("locations")
        return r.json()
      }),
    ])
      .then(([artistData, locData]: [Artist, ArtistLocation[]]) => {
        setArtist(artistData)
        setLocations(locData)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /* ── Refresh (after add/edit) ────────────────────────────────── */
  function handleMutationSuccess() {
    setShowAddForm(false)
    setEditingId(null)
    // Re-fetch locations only — lighter than fetching artist again
    if (!params.id) return
    fetch(`/api/artists/${params.id}/locations`)
      .then((r) => {
        if (!r.ok) throw new Error("refresh")
        return r.json()
      })
      .then((data: ArtistLocation[]) => setLocations(data))
      .catch(() => {
        /* silent — data is stale but still visible */
      })
  }

  /* ── Delete ──────────────────────────────────────────────────── */
  async function handleDelete(locationId: string) {
    if (!params.id) return
    setDeletingId(locationId)

    try {
      const res = await fetch(
        `/api/artists/${params.id}/locations/${locationId}`,
        { method: "DELETE" },
      )
      if (!res.ok && res.status !== 204) throw new Error("delete")
      setLocations((prev) => prev.filter((l) => l.id !== locationId))
    } catch {
      /* refresh to show correct state */
      handleMutationSuccess()
    } finally {
      setDeletingId(null)
    }
  }

  /* ── Loading ─────────────────────────────────────────────────── */
  if (loading) return <PageSkeleton />

  /* ── Error ───────────────────────────────────────────────────── */
  if (error || !artist) return <ErrorState />

  /* ── Derived ─────────────────────────────────────────────────── */
  const name = artist.displayName || artist.instagramHandle
  const primaryLocs = locations.filter((l) => l.isPrimary)
  const guestSpots = locations.filter((l) => l.isGuestSpot && !l.isPrimary)
  const otherLocs = locations.filter((l) => !l.isPrimary && !l.isGuestSpot)
  const sortedLocations = [...primaryLocs, ...guestSpots, ...otherLocs]

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Back link ──────────────────────────────────────────── */}
      <Link
        href={`/artists/${params.id}`}
        className="group/back inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5 transition-transform group-hover/back:-translate-x-0.5" />
        Back to artist
      </Link>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-foreground">
            Locations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {name}
            {locations.length > 0 && (
              <span className="text-muted-foreground/50">
                {" "}
                · {locations.length}{" "}
                {locations.length === 1 ? "location" : "locations"}
              </span>
            )}
          </p>
        </div>

        {!showAddForm && (
          <Button
            onClick={() => {
              setShowAddForm(true)
              setEditingId(null)
            }}
            className="shrink-0 bg-brand-500 text-black hover:bg-brand-400"
          >
            <Plus className="size-3.5" />
            Add Location
          </Button>
        )}
      </div>

      {/* ── Add form ───────────────────────────────────────────── */}
      {showAddForm && (
        <Card>
          <CardContent>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-foreground">
                New location
              </h3>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <LocationForm
              artistId={params.id!}
              onSuccess={handleMutationSuccess}
              onCancel={() => setShowAddForm(false)}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Location list ──────────────────────────────────────── */}
      {sortedLocations.length > 0 ? (
        <div className="space-y-3">
          {sortedLocations.map((loc) =>
            editingId === loc.id ? (
              <LocationCardEdit
                key={loc.id}
                location={loc}
                artistId={params.id!}
                onSuccess={handleMutationSuccess}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <LocationCardDisplay
                key={loc.id}
                location={loc}
                onEdit={() => {
                  setEditingId(loc.id)
                  setShowAddForm(false)
                }}
                onDelete={() => handleDelete(loc.id)}
                isDeleting={deletingId === loc.id}
              />
            ),
          )}
        </div>
      ) : (
        !showAddForm && (
          <Card>
            <CardContent>
              <div className="flex flex-col items-center py-10 text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
                  <MapPin
                    className="size-6 text-muted-foreground/30"
                    strokeWidth={1.5}
                  />
                </div>

                <p className="font-medium text-foreground">
                  No locations yet
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add the first one!
                </p>

                <Button
                  onClick={() => setShowAddForm(true)}
                  className="mt-5 bg-brand-500 text-black hover:bg-brand-400"
                  size="sm"
                >
                  <Plus className="size-3.5" />
                  Add Location
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  )
}
