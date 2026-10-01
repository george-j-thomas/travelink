"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
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
import { MetalCanvas } from "@/components/metal/metal-canvas"
import { Screws, SpikeStar } from "@/components/metal/ornaments"
import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

type FilterType = "all" | "primary" | "guest_spot"

/* ═══════════════════════════════════════════════════════════════════════
   Frame: gunmetal pillars down both sides, each carrying a chrome spike
   rail whose thorns reach into the map toward the cursor (md and up).
   The frame stays mounted while the content below it changes, so the
   rails don't rebuild on every filter change.
   ═══════════════════════════════════════════════════════════════════ */

function Pillar({ side }: { side: "left" | "right" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "metal-column absolute inset-y-0 z-[5] hidden w-16 md:block",
        side === "left" ? "left-0" : "right-0",
      )}
    >
      <span
        className={cn(
          "flow-line-y absolute inset-y-0 w-0.5",
          side === "left" ? "right-0" : "left-0 [animation-direction:reverse]",
        )}
      />
      <Screws inset={9} size={6} />
    </div>
  )
}

function MapFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-10 bg-background">
      <Pillar side="left" />
      <Pillar side="right" />
      <div className="absolute inset-0 overflow-hidden md:inset-x-16">{children}</div>
      {/* Rails stop short of the bottom so Mapbox's logo and attribution stay clear */}
      {(["left", "right"] as const).map((side) => (
        <MetalCanvas
          key={side}
          scene="rail"
          layout={side}
          className={cn(
            "absolute top-0 bottom-10 z-[15] hidden w-[150px] md:block",
            side === "left" ? "left-0" : "right-0",
          )}
          fallback={
            <div className={cn("absolute inset-y-0 flex w-16 flex-col items-center justify-around", side === "left" ? "left-0" : "right-0")}>
              {[0, 1, 2].map((i) => (
                <SpikeStar key={i} className="size-12" points={9 + i * 2} seed={60 + i} tone={i === 1 ? "chrome" : "gun"} />
              ))}
            </div>
          }
        />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Loading skeleton
   ═══════════════════════════════════════════════════════════════════ */

function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-5">
        <SpikeStar className="size-16 animate-pulse" points={12} seed={64} tone="ice" />
        <div className="space-y-2 text-center">
          <div className="mx-auto h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mx-auto h-3 w-48 animate-pulse rounded bg-muted" />
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
    <div className="absolute inset-0 flex items-center justify-center">
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
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════════ */

function EmptyState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 px-4 text-center">
        <div className="metal-surface relative mb-2 flex size-20 items-center justify-center rounded-2xl">
          <Screws inset={5} size={4} />
          <MapPin
            className="size-10 text-brand-300"
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
          <Button className="font-medium" size="lg">
            <Plus className="size-4" />
            Add Your First Artist
          </Button>
        </Link>
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
  if (loading) return <MapFrame><MapSkeleton /></MapFrame>
  if (error) return <MapFrame><MapError onRetry={() => fetchData(activeFilter)} /></MapFrame>
  if (!data || data.features.length === 0) return <MapFrame><EmptyState /></MapFrame>

  return (
    <MapFrame>
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
    </MapFrame>
  )
}
