"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  Loader2,
  MapPin,
  Search,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface LocationData {
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

interface LocationFormProps {
  artistId: string
  location?: LocationData
  onSuccess: () => void
  onCancel?: () => void
}

interface MapboxFeature {
  id: string
  place_name: string
  text: string
  center: [number, number]
  context?: Array<{ id: string; text: string; short_code?: string }>
}

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function extractCountry(feature: MapboxFeature): string {
  const country = feature.context?.find((c) => c.id.startsWith("country."))
  return country?.text ?? ""
}

function extractCity(feature: MapboxFeature): string {
  return feature.text
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return ""
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Toggle pill (custom checkbox replacement)
   ═══════════════════════════════════════════════════════════════════ */

function TogglePill({
  checked,
  onChange,
  label,
  accentClass = "border-amber-500/30 bg-amber-500/10 text-amber-400",
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  accentClass?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-all select-none",
        checked
          ? accentClass
          : "border-border bg-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground",
      )}
    >
      {checked && <Check className="size-3" />}
      {label}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   LocationForm
   ═══════════════════════════════════════════════════════════════════ */

export function LocationForm({
  artistId,
  location,
  onSuccess,
  onCancel,
}: LocationFormProps) {
  const isEditing = !!location

  /* ── Form state ──────────────────────────────────────────────── */
  const [locationName, setLocationName] = useState(
    location?.locationName ?? "",
  )
  const [city, setCity] = useState(location?.city ?? "")
  const [country, setCountry] = useState(location?.country ?? "")
  const [lat, setLat] = useState(location?.lat?.toString() ?? "")
  const [lng, setLng] = useState(location?.lng?.toString() ?? "")
  const [isPrimary, setIsPrimary] = useState(location?.isPrimary ?? false)
  const [isGuestSpot, setIsGuestSpot] = useState(
    location?.isGuestSpot ?? false,
  )
  const [startDate, setStartDate] = useState(
    toDateInputValue(location?.startDate ?? null),
  )
  const [endDate, setEndDate] = useState(
    toDateInputValue(location?.endDate ?? null),
  )

  /* ── Autocomplete state ──────────────────────────────────────── */
  const [query, setQuery] = useState(location?.locationName ?? "")
  const [results, setResults] = useState<MapboxFeature[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  /* ── Save state ──────────────────────────────────────────────── */
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ── Close dropdown on outside click ─────────────────────────── */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  /* ── Mapbox geocode ──────────────────────────────────────────── */
  const searchMapbox = useCallback(async (q: string) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token || q.trim().length < 2) {
      setResults([])
      return
    }

    setSearching(true)
    try {
      const encoded = encodeURIComponent(q.trim())
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${token}&limit=5&types=place,locality,neighborhood`,
      )
      if (!res.ok) throw new Error("Geocode failed")
      const data = await res.json()
      setResults(data.features ?? [])
      setShowDropdown(true)
      setHighlightIdx(-1)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    setLocationName(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    debounceRef.current = setTimeout(() => searchMapbox(value), 300)
  }

  function selectResult(feature: MapboxFeature) {
    const cityName = extractCity(feature)
    const countryName = extractCountry(feature)

    setQuery(feature.place_name)
    setLocationName(feature.place_name)
    setCity(cityName)
    setCountry(countryName)
    setLng(feature.center[0].toString())
    setLat(feature.center[1].toString())
    setResults([])
    setShowDropdown(false)
  }

  /* ── Keyboard navigation ─────────────────────────────────────── */
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || results.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightIdx((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === "Enter" && highlightIdx >= 0) {
      e.preventDefault()
      selectResult(results[highlightIdx])
    } else if (e.key === "Escape") {
      setShowDropdown(false)
    }
  }

  /* ── Submit ──────────────────────────────────────────────────── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!locationName.trim()) {
      setError("Location name is required")
      return
    }

    const payload = {
      locationName: locationName.trim(),
      city: city.trim() || null,
      country: country.trim() || null,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      isPrimary,
      isGuestSpot,
      startDate: startDate || null,
      endDate: endDate || null,
    }

    setSaving(true)
    try {
      const url = isEditing
        ? `/api/artists/${artistId}/locations/${location.id}`
        : `/api/artists/${artistId}/locations`
      const method = isEditing ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(
          (data as { error?: string }).error || "Failed to save location",
        )
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ──────────────────────────────────────────────────── */
  const isBioParsed = isEditing && location.source === "bio"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Bio-parsed warning ────────────────────────────────── */}
      {isBioParsed && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <p className="text-sm leading-relaxed text-amber-300/90">
            This location was auto-detected from the artist&apos;s bio. Editing
            it will mark it as manually set and it won&apos;t be updated on bio
            refresh.
          </p>
        </div>
      )}

      {/* ── Location search ───────────────────────────────────── */}
      <div ref={containerRef} className="relative">
        <Label htmlFor="location-search" className="mb-2">
          Location
        </Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50">
            {searching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Search className="size-3.5" />
            )}
          </span>
          <Input
            id="location-search"
            type="text"
            placeholder="Search for a city or place…"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            className="pl-8"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setLocationName("")
                setResults([])
                setShowDropdown(false)
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* ── Autocomplete dropdown ─────────────────────────── */}
        {showDropdown && results.length > 0 && (
          <ul
            role="listbox"
            className="absolute top-full z-50 mt-1.5 w-full overflow-hidden rounded-lg border border-border/60 bg-card shadow-xl shadow-black/30"
          >
            {results.map((feature, idx) => (
              <li
                key={feature.id}
                role="option"
                aria-selected={idx === highlightIdx}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => selectResult(feature)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm transition-colors",
                  idx === highlightIdx
                    ? "bg-amber-500/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <MapPin
                  className={cn(
                    "size-3.5 shrink-0",
                    idx === highlightIdx
                      ? "text-amber-500"
                      : "text-muted-foreground/40",
                  )}
                />
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">
                    {feature.text}
                  </span>
                  {extractCountry(feature) && (
                    <span className="text-muted-foreground">
                      {" "}
                      — {extractCountry(feature)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── City / Country ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="loc-city">City</Label>
          <Input
            id="loc-city"
            type="text"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loc-country">Country</Label>
          <Input
            id="loc-country"
            type="text"
            placeholder="Country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
      </div>

      {/* ── Lat / Lng ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="loc-lat">
            Latitude{" "}
            <span className="font-normal text-muted-foreground/50">
              optional
            </span>
          </Label>
          <Input
            id="loc-lat"
            type="number"
            step="any"
            placeholder="e.g. 40.7128"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="loc-lng">
            Longitude{" "}
            <span className="font-normal text-muted-foreground/50">
              optional
            </span>
          </Label>
          <Input
            id="loc-lng"
            type="number"
            step="any"
            placeholder="e.g. -74.0060"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
          />
        </div>
      </div>

      {/* ── Toggles ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <TogglePill
          checked={isPrimary}
          onChange={setIsPrimary}
          label="Primary location"
          accentClass="border-amber-500/30 bg-amber-500/10 text-amber-400"
        />
        <TogglePill
          checked={isGuestSpot}
          onChange={setIsGuestSpot}
          label="Guest spot"
          accentClass="border-purple-500/30 bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* ── Guest-spot dates ──────────────────────────────────── */}
      {isGuestSpot && (
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="loc-start">Start date</Label>
            <Input
              id="loc-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="loc-end">End date</Label>
            <Input
              id="loc-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          type="submit"
          disabled={saving}
          className="bg-amber-500 text-black hover:bg-amber-400"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {saving ? "Saving…" : isEditing ? "Update location" : "Save location"}
        </Button>

        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
