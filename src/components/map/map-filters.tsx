"use client"

import { Globe, MapPin, Plane } from "lucide-react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface MapFiltersProps {
  activeFilter: "all" | "primary" | "guest_spot"
  onFilterChange: (filter: "all" | "primary" | "guest_spot") => void
  sidebarOpen: boolean
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
  sidebarOpen,
}: MapFiltersProps) {
  return (
    <div
      className={cn(
        "absolute top-4 left-1/2 z-20 w-max -translate-x-1/2 transition-[left] duration-300 ease-out",
        // Centre over the map the open sidebar (w-80) leaves visible. On phones
        // it covers nearly all of the map, so there's no room to move to
        sidebarOpen && "sm:left-[calc(50%+10rem)]",
      )}
    >
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
