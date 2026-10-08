"use client"

import { Globe, MapPin, Plane } from "lucide-react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface MapFiltersProps {
  activeFilter: "all" | "primary" | "guest_spot"
  onFilterChange: (filter: "all" | "primary" | "guest_spot") => void
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
}: MapFiltersProps) {
  return (
    <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
      <nav
        className="flex items-center gap-1 rounded-xl border border-border/50 bg-background/80 p-1 shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150"
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
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              aria-pressed={isActive}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
