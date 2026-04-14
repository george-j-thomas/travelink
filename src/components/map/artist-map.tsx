"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Map, Source, Layer, Popup } from "react-map-gl/mapbox"
import type { MapRef } from "react-map-gl/mapbox"
import type { MapMouseEvent, GeoJSONSource } from "mapbox-gl"
import Link from "next/link"
import { MapPin, Plane, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function isTruthy(val: unknown): boolean {
  return val === true || val === "true" || val === 1
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

/* ═══════════════════════════════════════════════════════════════════════
   Layer definitions
   ═══════════════════════════════════════════════════════════════════ */

const clusterLayer = {
  id: "clusters",
  type: "circle" as const,
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#f59e0b", // amber-500 — small clusters
      10,
      "#d97706", // amber-600 — medium
      50,
      "#b45309", // amber-700 — large
    ],
    "circle-radius": [
      "step",
      ["get", "point_count"],
      18, // default
      10,
      24, // 10+ points
      50,
      32, // 50+ points
    ],
    "circle-opacity": 0.85,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#fbbf24",
    "circle-stroke-opacity": 0.3,
  },
}

const clusterCountLayer = {
  id: "cluster-count",
  type: "symbol" as const,
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"] as ["get", string],
    "text-size": 13,
    "text-font": ["DIN Pro Medium", "Arial Unicode MS Bold"],
  },
  paint: {
    "text-color": "#ffffff",
  },
}

const unclusteredPointLayer = {
  id: "unclustered-point",
  type: "circle" as const,
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": [
      "case",
      ["get", "isGuestSpot"],
      "#c084fc", // purple-400 for guest spots
      "#f59e0b", // amber-500 for primary / home base
    ],
    "circle-radius": 8,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-opacity": 0.2,
  },
}

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface ArtistMapProps {
  data: GeoJSON.FeatureCollection
  onVisibleFeaturesChange: (features: GeoJSON.Feature[]) => void
}

interface SelectedFeature {
  longitude: number
  latitude: number
  properties: Record<string, unknown>
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export const ArtistMap = forwardRef<MapRef, ArtistMapProps>(
  function ArtistMap({ data, onVisibleFeaturesChange }, forwardedRef) {
    const localRef = useRef<MapRef>(null)
    const [selectedFeature, setSelectedFeature] =
      useState<SelectedFeature | null>(null)
    const [cursor, setCursor] = useState("")

    // Expose map ref to parent for flyTo / external control
    useImperativeHandle(forwardedRef, () => localRef.current as MapRef, [])

    /* ── Query visible (unclustered) features ── */
    const updateVisibleFeatures = useCallback(() => {
      const map = localRef.current?.getMap()
      if (!map || !map.isStyleLoaded()) return

      try {
        if (!map.getLayer("unclustered-point")) return

        const canvas = map.getCanvas()
        const rendered = map.queryRenderedFeatures(
          [
            [0, 0],
            [canvas.width, canvas.height],
          ],
          { layers: ["unclustered-point"] },
        )

        // Deduplicate by locationId
        const seen = new Set<string>()
        const unique: GeoJSON.Feature[] = []
        for (const f of rendered) {
          const id = f.properties?.locationId as string
          if (id && !seen.has(id)) {
            seen.add(id)
            unique.push({
              type: "Feature",
              geometry: f.geometry,
              properties: f.properties,
            })
          }
        }

        onVisibleFeaturesChange(unique)
      } catch {
        // Map may not be fully ready yet — ignore
      }
    }, [onVisibleFeaturesChange])

    /* ── Click handler ── */
    const handleClick = useCallback((event: MapMouseEvent) => {
      // react-map-gl attaches queried features from interactiveLayerIds
      const features = (
        event as MapMouseEvent & { features?: GeoJSON.Feature[] }
      ).features
      const feature = features?.[0]

      // Click on empty space → close popup
      if (!feature) {
        setSelectedFeature(null)
        return
      }

      const layerId = (feature as GeoJSON.Feature & { layer?: { id: string } })
        .layer?.id

      // Click on cluster → expand
      if (layerId === "clusters") {
        const clusterId = feature.properties?.cluster_id as number
        const map = localRef.current?.getMap()
        if (!map) return

        const source = map.getSource("artists") as GeoJSONSource
        if (!source) return

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || zoom == null) return
          const coords = (feature.geometry as GeoJSON.Point).coordinates
          localRef.current?.flyTo({
            center: [coords[0], coords[1]],
            zoom,
            duration: 500,
          })
        })
        return
      }

      // Click on unclustered point → show popup
      if (layerId === "unclustered-point") {
        const coords = (
          feature.geometry as GeoJSON.Point
        ).coordinates.slice() as [number, number]

        // Handle antimeridian wrapping
        while (Math.abs(event.lngLat.lng - coords[0]) > 180) {
          coords[0] += event.lngLat.lng > coords[0] ? 360 : -360
        }

        setSelectedFeature({
          longitude: coords[0],
          latitude: coords[1],
          properties: feature.properties ?? {},
        })
      }
    }, [])

    /* ── Popup data ── */
    const p = selectedFeature?.properties
    const displayName =
      (p?.displayName as string) || (p?.handle as string) || "Unknown"
    const handle = p?.handle as string
    const locationName = p?.locationName as string
    const city = p?.city as string
    const country = p?.country as string
    const isPrimary = isTruthy(p?.isPrimary)
    const isGuestSpot = isTruthy(p?.isGuestSpot)
    const artistId = p?.artistId as string
    const profilePicUrl = p?.profilePicUrl as string
    const locationText =
      [city, country].filter(Boolean).join(", ") || locationName

    return (
      <Map
        ref={localRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        initialViewState={{
          longitude: 0,
          latitude: 20,
          zoom: 2,
        }}
        style={{ width: "100%", height: "100%" }}
        interactiveLayerIds={["clusters", "unclustered-point"]}
        onClick={handleClick}
        onMouseEnter={() => setCursor("pointer")}
        onMouseLeave={() => setCursor("")}
        cursor={cursor}
        onIdle={updateVisibleFeatures}
      >
        <Source
          id="artists"
          type="geojson"
          data={data}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          {/* @ts-expect-error – mapbox expression types are overly strict */}
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          {/* @ts-expect-error – mapbox expression types are overly strict */}
          <Layer {...unclusteredPointLayer} />
        </Source>

        {/* ── Popup ─────────────────────────────────────────────── */}
        {selectedFeature && (
          <Popup
            longitude={selectedFeature.longitude}
            latitude={selectedFeature.latitude}
            anchor="bottom"
            onClose={() => setSelectedFeature(null)}
            closeButton={false}
            closeOnClick={false}
            maxWidth="320px"
            offset={16}
            className="artist-popup"
          >
            <div className="min-w-[220px] max-w-[280px] overflow-hidden rounded-xl bg-background/95 text-foreground shadow-2xl ring-1 ring-border/50 backdrop-blur-xl">
              <div className="p-3.5">
                {/* ── Header: avatar + identity + close ── */}
                <div className="flex items-start gap-3">
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-amber-500/15">
                    {profilePicUrl ? (
                      <img
                        src={profilePicUrl}
                        alt=""
                        className="size-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex size-10 items-center justify-center text-xs font-semibold text-amber-500">
                        {getInitials(displayName)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-snug">
                      {displayName}
                    </p>
                    {handle && (
                      <p className="truncate text-xs text-muted-foreground">
                        @{handle}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedFeature(null)}
                    className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Close popup"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                {/* ── Location ── */}
                <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {isGuestSpot ? (
                    <Plane className="size-3 shrink-0 text-purple-400" />
                  ) : (
                    <MapPin className="size-3 shrink-0 text-amber-500" />
                  )}
                  <span className="truncate">{locationText}</span>
                </div>

                {/* ── Badges ── */}
                <div className="mt-2 flex items-center gap-1.5">
                  {isPrimary && (
                    <Badge
                      variant="secondary"
                      className="border border-amber-500/20 bg-amber-500/10 text-amber-400"
                    >
                      Primary
                    </Badge>
                  )}
                  {isGuestSpot && (
                    <Badge
                      variant="secondary"
                      className="border border-purple-500/20 bg-purple-500/10 text-purple-400"
                    >
                      Guest Spot
                    </Badge>
                  )}
                </div>

                {/* ── Profile link ── */}
                {artistId && (
                  <Link
                    href={`/artists/${artistId}`}
                    className="mt-3 block text-xs font-medium text-amber-500 transition-colors hover:text-amber-400"
                  >
                    View profile →
                  </Link>
                )}
              </div>
            </div>
          </Popup>
        )}
      </Map>
    )
  },
)
