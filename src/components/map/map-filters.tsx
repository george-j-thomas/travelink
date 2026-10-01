"use client"

import { Globe, MapPin, Navigation, Plane } from "lucide-react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface MapFiltersProps {
  activeFilter: "all" | "primary" | "guest_spot"
  onFilterChange: (filter: "all" | "primary" | "guest_spot") => void
  onLocateMe: () => void
}

/* ═══════════════════════════════════════════════════════════════════════
   Filter definitions
   ═══════════════════════════════════════════════════════════════════ */

const filters = [
  { value: "all" as const, label: "All", icon: Globe },
  { value: "primary" as const, label: "Home bases", icon: MapPin },
  { value: "guest_spot" as const, label: "Guest spots", icon: Plane },
]

/* ═══════════════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════════ */

export function MapFilters({
  activeFilter,
  onFilterChange,
  onLocateMe,
}: MapFiltersProps) {
  return (
    <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
      <nav
        className="glass flow-edge relative flex items-center gap-1 rounded-xl p-1 [--edge-dur:8s]"
        aria-label="Map filters"
      >
        {/* ── Type filters ── */}
        {filters.map(({ value, label, icon: Icon }) => {
          const isActive = activeFilter === value

          return (
            <button
              key={value}
              onClick={() => onFilterChange(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                isActive
                  ? "btn-gunmetal"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={isActive}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}

        {/* ── Separator ── */}
        <div
          className="mx-0.5 h-5 w-px bg-white/10"
          role="separator"
          aria-orientation="vertical"
        />

        {/* ── Locate me ── */}
        <button
          onClick={onLocateMe}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          title="Find my location"
          aria-label="Find my location"
        >
          <Navigation className="size-3.5" />
          <span className="hidden sm:inline">Near me</span>
        </button>
      </nav>
    </div>
  )
}
