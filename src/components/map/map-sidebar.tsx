"use client"

import { useState } from "react"
import type * as GeoJSON from "geojson"
import { ChevronLeft, ChevronRight, MapPin, Plane, Users } from "lucide-react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface MapSidebarProps {
  features: GeoJSON.Feature[]
  onSelectFeature: (feature: GeoJSON.Feature) => void
  isOpen: boolean
  onToggle: () => void
}

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
   Avatar
   ═══════════════════════════════════════════════════════════════════ */

type PhotoStatus = "loading" | "loaded" | "failed"

// Initials sit under the photo, so they show while it loads and stay when the
// link is missing or dead (Instagram links expire). The photo is invisible
// until it has loaded, so a broken-image icon never paints. Load state is kept
// per URL, since rows get reused for other artists as the list re-sorts.
function SidebarAvatar({
  url,
  name,
  isGuestSpot,
}: {
  url?: string | null
  name: string
  isGuestSpot: boolean
}) {
  const src = url || ""
  const [photo, setPhoto] = useState<{ url: string; status: PhotoStatus } | null>(null)
  const status: PhotoStatus = photo?.url === src ? photo.status : "loading"
  const settle = (next: PhotoStatus) =>
    setPhoto((prev) =>
      prev?.url === src && prev.status === next ? prev : { url: src, status: next },
    )

  return (
    <div aria-hidden="true" className="relative size-9 shrink-0 select-none">
      <div className="relative flex size-full items-center justify-center overflow-hidden rounded-full bg-brand-500/15 text-xs font-semibold text-brand-400">
        {getInitials(name)}
        {src && status !== "failed" && (
          <img
            key={src}
            ref={(img) => {
              // Cached photos are ready at mount; show them on the first paint
              if (img?.complete && img.naturalWidth > 0) settle("loaded")
            }}
            src={src}
            alt=""
            onLoad={() => settle("loaded")}
            onError={() => settle("failed")}
            className={cn(
              "absolute inset-0 size-full rounded-full object-cover transition-opacity duration-200 motion-reduce:transition-none",
              status === "loaded" ? "opacity-100" : "opacity-0",
            )}
          />
        )}
      </div>

      {/* Type indicator dot, outside the clipped circle so it's never cut off */}
      <span
        className={cn(
          "absolute right-0 bottom-0 size-3 rounded-full ring-2 ring-background",
          isGuestSpot ? "bg-guest-500" : "bg-brand-400",
        )}
      />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export function MapSidebar({
  features,
  onSelectFeature,
  isOpen,
  onToggle,
}: MapSidebarProps) {
  // Sort: primary locations first, then guest spots
  const sorted = [...features].sort((a, b) => {
    const aP = isTruthy(a.properties?.isPrimary) ? 0 : 1
    const bP = isTruthy(b.properties?.isPrimary) ? 0 : 1
    return aP - bP
  })

  return (
    <div className="absolute top-0 left-0 bottom-0 z-20 flex">
      {/* ── Panel ────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex h-full w-80 shrink-0 flex-col border-r border-border/30 bg-background/95 backdrop-blur-xl transition-[margin] duration-300 ease-out",
          isOpen ? "ml-0" : "-ml-80",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/30 px-4 py-3">
          <Users className="size-4 text-brand-400" />
          <h2 className="text-sm font-semibold text-foreground">
            Nearby Artists
          </h2>
          <span className="ml-auto rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-400">
            {features.length}
          </span>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <MapPin
                className="mb-2 size-6 text-muted-foreground/30"
                strokeWidth={1.5}
              />
              <p className="text-sm text-muted-foreground">
                No artists in this area
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Pan or zoom to explore
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/20" role="list">
              {sorted.map((feature, i) => {
                const props = feature.properties ?? {}
                const name =
                  (props.displayName as string) ||
                  (props.handle as string) ||
                  "Unknown"
                const handle = props.handle as string
                const locationName = props.locationName as string
                const city = props.city as string
                const country = props.country as string
                const isPrimary = isTruthy(props.isPrimary)
                const isGuestSpot = isTruthy(props.isGuestSpot)
                const profilePicUrl = props.profilePicUrl as string
                const locationText =
                  [city, country].filter(Boolean).join(", ") || locationName

                return (
                  <li key={`${props.locationId}-${i}`}>
                    <button
                      onClick={() => onSelectFeature(feature)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-500/5"
                    >
                      <SidebarAvatar
                        url={profilePicUrl}
                        name={name}
                        isGuestSpot={isGuestSpot}
                      />

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {name}
                        </p>
                        {handle && (
                          <p className="truncate text-xs text-muted-foreground">
                            @{handle}
                          </p>
                        )}
                        <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground/70">
                          {isGuestSpot ? (
                            <Plane className="size-3 shrink-0 text-guest-500" />
                          ) : isPrimary ? (
                            <MapPin className="size-3 shrink-0 text-brand-400" />
                          ) : (
                            <MapPin className="size-3 shrink-0 text-muted-foreground" />
                          )}
                          {locationText}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Toggle tab ───────────────────────────────────────── */}
      <button
        onClick={onToggle}
        className="mt-20 flex h-14 w-7 shrink-0 items-center justify-center rounded-r-xl border border-l-0 border-border/30 bg-background/90 text-muted-foreground backdrop-blur-xl transition-colors hover:bg-muted hover:text-foreground"
        aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronLeft className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>
    </div>
  )
}
