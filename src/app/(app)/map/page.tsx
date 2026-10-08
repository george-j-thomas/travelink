"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  MapPin,
  AlertCircle,
  Plus,
  RefreshCw,
  UserRoundPlus,
} from "lucide-react"
import type { MapRef } from "react-map-gl/mapbox"

import { ArtistMap } from "@/components/map/artist-map"
import { MapFilters } from "@/components/map/map-filters"
import { MapSidebar } from "@/components/map/map-sidebar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

type FilterType = "all" | "primary" | "guest_spot"

/* ═══════════════════════════════════════════════════════════════════════
   Loading skeleton
   ═══════════════════════════════════════════════════════════════════ */

function MapSkeleton() {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10 bg-background">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="size-12 animate-pulse rounded-full bg-brand-500/20" />
            <MapPin className="absolute inset-0 m-auto size-6 animate-pulse text-brand-400/60" />
          </div>
          <div className="space-y-2 text-center">
            <div className="mx-auto h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="mx-auto h-3 w-48 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Error state
   ═══════════════════════════════════════════════════════════════════ */

function MapError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10 bg-background">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
            <AlertCircle
              className="size-8 text-destructive"
              strokeWidth={1.5}
            />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              Failed to load map data
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Something went wrong. Please try again.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════════ */

function EmptyState() {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10 bg-background">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-4 text-center">
          <div className="mb-2 flex size-20 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
            <MapPin
              className="size-10 text-brand-400/80"
              strokeWidth={1.5}
            />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              No artist locations to display
            </p>
            <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Add some artists first!
            </p>
          </div>
          <Link href="/artists/add" className="mt-2">
            <Button
              className="bg-brand-600 font-medium text-white hover:bg-brand-700"
              size="lg"
            >
              <Plus className="size-4" />
              Add Your First Artist
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   No-artists modal (new users)
   ═══════════════════════════════════════════════════════════════════ */

function NoArtistsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
            <UserRoundPlus className="size-6 text-brand-400/90" strokeWidth={1.5} />
          </div>
          <DialogTitle>Add artists to fill your map</DialogTitle>
          <DialogDescription>
            Your map is empty because you haven&apos;t saved any artists yet.
            Head to the Artists tab to import your Instagram following or add
            artists by hand — they&apos;ll appear here once we find their
            locations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Link href="/artists">
            <Button className="w-full bg-brand-600 font-medium text-white hover:bg-brand-700 sm:w-auto">
              <UserRoundPlus className="size-4" />
              Go to Artists
            </Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Empty map backdrop (shown behind the no-artists modal)
   ═══════════════════════════════════════════════════════════════════ */

function EmptyMapBackdrop() {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10 bg-background">
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 px-4 text-center opacity-60">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
            <MapPin className="size-10 text-brand-400/80" strokeWidth={1.5} />
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            Nothing on the map yet.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════ */

export default function MapPage() {
  const mapRef = useRef<MapRef>(null)
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>("all")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [visibleFeatures, setVisibleFeatures] = useState<GeoJSON.Feature[]>([])
  const [artistCount, setArtistCount] = useState<number | null>(null)
  const [modalDismissed, setModalDismissed] = useState(false)

  /* ── Data fetching ── */
  const fetchData = useCallback(async (filter: FilterType) => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams()
      if (filter !== "all") params.set("type", filter)
      const qs = params.toString()
      const res = await fetch(`/api/map${qs ? `?${qs}` : ""}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const geojson = await res.json()
      setData(geojson)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(activeFilter)
  }, [activeFilter, fetchData])

  /* ── Artist count (gates the new-user modal) ── */
  useEffect(() => {
    let cancelled = false
    fetch("/api/artists")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((artists: unknown[]) => {
        if (!cancelled) setArtistCount(Array.isArray(artists) ? artists.length : 0)
      })
      .catch(() => {
        if (!cancelled) setArtistCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /* ── Event handlers ── */
  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter)
  }, [])

  const handleSelectFeature = useCallback((feature: GeoJSON.Feature) => {
    const coords = (feature.geometry as GeoJSON.Point).coordinates
    mapRef.current?.flyTo({
      center: [coords[0], coords[1]],
      zoom: 14,
      duration: 1500,
    })
  }, [])

  const handleVisibleFeaturesChange = useCallback(
    (features: GeoJSON.Feature[]) => {
      setVisibleFeatures(features)
    },
    [],
  )

  /* ── Render ── */
  if (loading) return <MapSkeleton />
  if (error) return <MapError onRetry={() => fetchData(activeFilter)} />

  const hasFeatures = !!data && data.features.length > 0

  if (!hasFeatures) {
    // New user with nothing saved → prompt them to add artists.
    if (artistCount === 0) {
      return (
        <>
          <EmptyMapBackdrop />
          <NoArtistsModal
            open={!modalDismissed}
            onOpenChange={(open) => setModalDismissed(!open)}
          />
        </>
      )
    }
    // Still resolving the artist count — avoid flashing the wrong empty state.
    if (artistCount === null) return <MapSkeleton />
    // Has artists, but none are mapped yet.
    return <EmptyState />
  }

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10">
      <ArtistMap
        ref={mapRef}
        data={data!}
        onVisibleFeaturesChange={handleVisibleFeaturesChange}
      />

      <MapFilters
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
      />

      <MapSidebar
        features={visibleFeatures}
        onSelectFeature={handleSelectFeature}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
      />
    </div>
  )
}
