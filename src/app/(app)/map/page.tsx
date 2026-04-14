"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  MapPin,
  AlertCircle,
  Plus,
  RefreshCw,
} from "lucide-react"
import type { MapRef } from "react-map-gl/mapbox"

import { ArtistMap } from "@/components/map/artist-map"
import { MapFilters } from "@/components/map/map-filters"
import { MapSidebar } from "@/components/map/map-sidebar"
import { Button } from "@/components/ui/button"

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
            <div className="size-12 animate-pulse rounded-full bg-amber-500/20" />
            <MapPin className="absolute inset-0 m-auto size-6 animate-pulse text-amber-500/60" />
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
          <div className="mb-2 flex size-20 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <MapPin
              className="size-10 text-amber-500/80"
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
              className="bg-amber-500 font-medium text-black hover:bg-amber-400"
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

  /* ── Event handlers ── */
  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter)
  }, [])

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 12,
          duration: 2000,
        })
      },
      () => {
        // Silently handle permission denial
      },
    )
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
  if (!data || data.features.length === 0) return <EmptyState />

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10">
      <ArtistMap
        ref={mapRef}
        data={data}
        onVisibleFeaturesChange={handleVisibleFeaturesChange}
      />

      <MapFilters
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        onLocateMe={handleLocateMe}
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
