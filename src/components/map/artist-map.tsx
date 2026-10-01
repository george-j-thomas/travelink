"use client"

import "mapbox-gl/dist/mapbox-gl.css"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { Map, Source, Layer, Popup } from "react-map-gl/mapbox"
import type { MapRef } from "react-map-gl/mapbox"
import type { MapMouseEvent, GeoJSONSource } from "mapbox-gl"
import Link from "next/link"
import { ChevronRight, MapPin, Plane, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function isTruthy(val: unknown): boolean {
  return val === true || val === "true" || val === 1
}

// Space kept clear above an open popup for the floating map filter bar
const POPUP_TOP_CLEARANCE = 76
const POPUP_EDGE_MARGIN = 12

// Points closer than this (in degrees) are treated as the same spot
const SAME_SPOT_EPSILON = 1e-4

function isSameSpot(features: GeoJSON.Feature[]): boolean {
  const [first, ...rest] = features.map(
    (f) => (f.geometry as GeoJSON.Point).coordinates,
  )
  return rest.every(
    (c) =>
      Math.abs(c[0] - first[0]) < SAME_SPOT_EPSILON &&
      Math.abs(c[1] - first[1]) < SAME_SPOT_EPSILON,
  )
}

type FeatureProps = Record<string, unknown>

function sortedUniqueByLocation(features: GeoJSON.Feature[]): FeatureProps[] {
  const seen = new Set<string>()
  const items: FeatureProps[] = []
  for (const f of features) {
    const props = f.properties ?? {}
    const key = String(props.locationId ?? `${props.artistId}-${items.length}`)
    if (seen.has(key)) continue
    seen.add(key)
    items.push(props)
  }
  return items.sort((a, b) =>
    displayNameOf(a).localeCompare(displayNameOf(b), undefined, {
      sensitivity: "base",
    }),
  )
}

function displayNameOf(p: FeatureProps): string {
  return (p.displayName as string) || (p.handle as string) || "Unknown"
}

function locationTextOf(p: FeatureProps): string {
  return (
    [p.city as string, p.country as string].filter(Boolean).join(", ") ||
    (p.locationName as string) ||
    ""
  )
}

function instagramUrl(handle: string): string {
  return `https://www.instagram.com/${encodeURIComponent(handle)}/`
}

// Mapbox listens for wheel events on the map container, so stop them from
// bubbling out of a scrollable popup list (otherwise scrolling zooms the map)
function stopWheelPropagation(el: HTMLElement | null) {
  el?.addEventListener("wheel", (e) => e.stopPropagation(), { passive: true })
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
      "#e23a10", // brand-500 — small clusters
      10,
      "#c22f0b", // brand-600 — medium
      50,
      "#a3260a", // brand-700 — large
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
    "circle-stroke-color": "#ffffff",
    "circle-stroke-opacity": 0.9,
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
      "#3b3d3c", // guest-600 (graphite) for guest spots
      "#e23a10", // brand-500 for primary / home base
    ],
    "circle-radius": 8,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-opacity": 0.95,
  },
}

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface ArtistMapProps {
  data: GeoJSON.FeatureCollection
  onVisibleFeaturesChange: (features: GeoJSON.Feature[]) => void
}

interface SelectedGroup {
  longitude: number
  latitude: number
  items: FeatureProps[]
}

/* ═══════════════════════════════════════════════════════════════════════
   Popup pieces
   ═══════════════════════════════════════════════════════════════════ */

function ArtistAvatar({ props, size }: { props: FeatureProps; size: "sm" | "md" }) {
  const url = props.profilePicUrl as string
  const dim = size === "md" ? "size-10" : "size-8"
  return (
    <div className={`relative ${dim} shrink-0 overflow-hidden rounded-full bg-brand-500/15`}>
      {url ? (
        <img src={url} alt="" className={`${dim} rounded-full object-cover`} />
      ) : (
        <span className={`flex ${dim} items-center justify-center text-xs font-semibold text-brand-500`}>
          {getInitials(displayNameOf(props))}
        </span>
      )}
    </div>
  )
}

function InstagramHandleLink({ handle }: { handle: string }) {
  return (
    <a
      href={instagramUrl(handle)}
      target="_blank"
      rel="noopener noreferrer"
      className="block truncate text-xs text-muted-foreground transition-colors hover:text-brand-600 hover:underline"
      title={`Open @${handle} on Instagram`}
    >
      @{handle}
    </a>
  )
}

function LocationLine({ props }: { props: FeatureProps }) {
  const isGuestSpot = isTruthy(props.isGuestSpot)
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {isGuestSpot ? (
        <Plane className="size-3 shrink-0 text-guest-500" />
      ) : (
        <MapPin className="size-3 shrink-0 text-brand-500" />
      )}
      <span className="truncate">{locationTextOf(props)}</span>
    </div>
  )
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Close popup"
    >
      <X className="size-3.5" />
    </button>
  )
}

function SingleArtistCard({ props, onClose }: { props: FeatureProps; onClose: () => void }) {
  const handle = props.handle as string
  const artistId = props.artistId as string
  const isPrimary = isTruthy(props.isPrimary)
  const isGuestSpot = isTruthy(props.isGuestSpot)

  return (
    <div className="p-3.5">
      {/* ── Header: avatar + identity + close ── */}
      <div className="flex items-start gap-3">
        <ArtistAvatar props={props} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">
            {displayNameOf(props)}
          </p>
          {handle && <InstagramHandleLink handle={handle} />}
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* ── Location ── */}
      <div className="mt-3">
        <LocationLine props={props} />
      </div>

      {/* ── Badges ── */}
      <div className="mt-2 flex items-center gap-1.5">
        {isPrimary && (
          <Badge
            variant="secondary"
            className="border border-brand-500/20 bg-brand-500/10 text-brand-600"
          >
            Primary
          </Badge>
        )}
        {isGuestSpot && (
          <Badge
            variant="secondary"
            className="border border-guest-500/20 bg-guest-500/10 text-guest-500"
          >
            Guest Spot
          </Badge>
        )}
      </div>

      {/* ── Profile link ── */}
      {artistId && (
        <Link
          href={`/artists/${artistId}`}
          className="mt-3 block text-xs font-medium text-brand-500 transition-colors hover:text-brand-600"
        >
          View profile →
        </Link>
      )}
    </div>
  )
}

function ArtistListCard({ items, onClose }: { items: FeatureProps[]; onClose: () => void }) {
  const places = new Set(items.map(locationTextOf).filter(Boolean))
  const heading = places.size === 1 ? [...places][0] : "This spot"

  return (
    <div>
      <div className="flex items-start gap-3 border-b border-border/50 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm leading-snug">{heading}</p>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{items.length} artists</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <ul ref={stopWheelPropagation} className="max-h-72 overflow-y-auto overscroll-contain py-1">
        {items.map((props) => {
          const handle = props.handle as string
          const artistId = props.artistId as string
          const isGuestSpot = isTruthy(props.isGuestSpot)
          return (
            <li
              key={String(props.locationId ?? artistId)}
              className="flex items-center gap-3 px-3.5 py-2 transition-colors hover:bg-muted/40"
            >
              <ArtistAvatar props={props} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {artistId ? (
                    <Link
                      href={`/artists/${artistId}`}
                      className="truncate text-sm font-medium leading-snug transition-colors hover:text-brand-600"
                    >
                      {displayNameOf(props)}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium leading-snug">
                      {displayNameOf(props)}
                    </span>
                  )}
                  {isGuestSpot && (
                    <Plane
                      className="size-3 shrink-0 text-guest-500"
                      aria-label="Guest spot"
                    />
                  )}
                </div>
                {handle && <InstagramHandleLink handle={handle} />}
              </div>
              {artistId && (
                <Link
                  href={`/artists/${artistId}`}
                  className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-brand-600"
                  aria-label={`View ${displayNameOf(props)}'s profile`}
                >
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export const ArtistMap = forwardRef<MapRef, ArtistMapProps>(
  function ArtistMap({ data, onVisibleFeaturesChange }, forwardedRef) {
    const localRef = useRef<MapRef>(null)
    const [selected, setSelected] = useState<SelectedGroup | null>(null)
    const [cursor, setCursor] = useState("")

    // Expose map ref to parent for flyTo / external control
    useImperativeHandle(forwardedRef, () => localRef.current as MapRef, [])

    /* ── Pan so an opened popup isn't clipped or hidden under controls ── */
    useEffect(() => {
      if (!selected) return
      const frame = requestAnimationFrame(() => {
        const map = localRef.current?.getMap()
        const popup = map?.getContainer().querySelector(".mapboxgl-popup")
        if (!map || !popup) return
        const bounds = map.getContainer().getBoundingClientRect()
        const rect = popup.getBoundingClientRect()
        const top = rect.top - bounds.top
        const left = rect.left - bounds.left
        const right = bounds.right - rect.right
        const dy = Math.min(0, top - POPUP_TOP_CLEARANCE)
        const dx =
          left < POPUP_EDGE_MARGIN
            ? left - POPUP_EDGE_MARGIN
            : right < POPUP_EDGE_MARGIN
              ? POPUP_EDGE_MARGIN - right
              : 0
        if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { duration: 300 })
      })
      return () => cancelAnimationFrame(frame)
    }, [selected])

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
      ).features ?? []
      const layerOf = (f: GeoJSON.Feature) =>
        (f as GeoJSON.Feature & { layer?: { id: string } }).layer?.id
      const feature = features[0]

      // Click on empty space → close popup
      if (!feature) {
        setSelected(null)
        return
      }

      const openAt = (coordinates: GeoJSON.Position, items: FeatureProps[]) => {
        const coords = coordinates.slice(0, 2) as [number, number]
        // Handle antimeridian wrapping
        while (Math.abs(event.lngLat.lng - coords[0]) > 180) {
          coords[0] += event.lngLat.lng > coords[0] ? 360 : -360
        }
        setSelected({ longitude: coords[0], latitude: coords[1], items })
      }

      // Click on cluster → list its artists if they share one spot, else zoom in
      if (layerOf(feature) === "clusters") {
        const clusterId = feature.properties?.cluster_id as number
        const pointCount = feature.properties?.point_count as number
        const source = localRef.current
          ?.getMap()
          .getSource("artists") as GeoJSONSource | undefined
        if (!source) return
        const clusterCoords = (feature.geometry as GeoJSON.Point).coordinates

        source.getClusterLeaves(clusterId, pointCount, 0, (leavesErr, leaves) => {
          if (!leavesErr && leaves && leaves.length > 0 && isSameSpot(leaves)) {
            openAt(clusterCoords, sortedUniqueByLocation(leaves))
            return
          }
          source.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || zoom == null) return
            setSelected(null)
            localRef.current?.flyTo({
              center: [clusterCoords[0], clusterCoords[1]],
              zoom,
              duration: 500,
            })
          })
        })
        return
      }

      // Click on point(s) → popup listing every artist stacked there
      const points = features.filter((f) => layerOf(f) === "unclustered-point")
      if (points.length > 0) {
        openAt(
          (points[0].geometry as GeoJSON.Point).coordinates,
          sortedUniqueByLocation(points),
        )
      }
    }, [])

    return (
      <Map
        ref={localRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
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
        {selected && (
          <Popup
            longitude={selected.longitude}
            latitude={selected.latitude}
            anchor="bottom"
            onClose={() => setSelected(null)}
            closeButton={false}
            closeOnClick={false}
            maxWidth="340px"
            offset={16}
            className="artist-popup"
          >
            <div className="min-w-[220px] max-w-[300px] overflow-hidden rounded-xl bg-background/95 text-foreground shadow-2xl ring-1 ring-border/50 backdrop-blur-xl">
              {selected.items.length === 1 ? (
                <SingleArtistCard
                  props={selected.items[0]}
                  onClose={() => setSelected(null)}
                />
              ) : (
                <ArtistListCard
                  items={selected.items}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>
          </Popup>
        )}
      </Map>
    )
  },
)
