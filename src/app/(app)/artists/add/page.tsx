"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Loader2,
  MapPin,
  Plus,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ArtistLocation {
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

interface ArtistResult {
  artist: {
    id: string
    instagramHandle: string
    displayName: string | null
    bio: string | null
    profilePicUrl: string | null
    accountType: string
  }
  locations: ArtistLocation[]
  status: "created" | "existing" | "updated"
  warnings: string[]
}

type ViewState = "idle" | "loading" | "success"

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STEPS = [
  "Fetching profile",
  "Parsing bio",
  "Geocoding locations",
] as const

const STEP_ADVANCE_MS = 1200
const DONE_PAUSE_MS = 500

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stripAt(raw: string) {
  return raw.replace(/^@+/, "").trim()
}

function validateHandle(value: string): string | null {
  if (!value) return "Please enter an Instagram handle"
  if (value.length > 30) return "Handle is too long (max 30 characters)"
  if (!/^[a-zA-Z0-9._]+$/.test(value))
    return "Handles can only contain letters, numbers, periods, and underscores"
  return null
}

function getInitials(name: string | null, handle: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
  }
  return handle.slice(0, 2).toUpperCase()
}

function formatLocation(loc: ArtistLocation): string {
  const parts = [loc.city, loc.country].filter(Boolean)
  return parts.length > 0 ? parts.join(", ") : loc.locationName
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AddArtistPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [handle, setHandle] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>("idle")
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<ArtistResult | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  function reset() {
    setHandle("")
    setError(null)
    setResult(null)
    setView("idle")
    setStep(0)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    const cleaned = stripAt(handle)
    setHandle(cleaned)

    const validationError = validateHandle(cleaned)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setView("loading")
    setStep(0)

    // Advance the step indicator while the API works
    timerRef.current = setInterval(() => {
      setStep((prev) => {
        if (prev < STEPS.length - 1) return prev + 1
        clearTimer()
        return prev
      })
    }, STEP_ADVANCE_MS)

    try {
      const res = await fetch("/api/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cleaned }),
      })

      clearTimer()

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(
          res.status === 429
            ? "Rate limited — please try again in a few minutes"
            : data.error || "Something went wrong. Please try again."
        )
        setView("idle")
        return
      }

      // Flash all steps as complete before showing result
      setStep(STEPS.length)
      await new Promise((r) => setTimeout(r, DONE_PAUSE_MS))

      setResult(data as ArtistResult)
      setView("success")
    } catch {
      clearTimer()
      setError("Network error — check your connection and try again")
      setView("idle")
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-lg pt-2 sm:pt-8">
      {/* Back link */}
      <Link
        href="/artists"
        className="group/back mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover/back:-translate-x-0.5" />
        Artists
      </Link>

      {/* ---------------------------------------------------------- */}
      {/*  Success view                                               */}
      {/* ---------------------------------------------------------- */}
      {view === "success" && result ? (
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-3 w-3 text-emerald-400" />
              </span>
              <CardTitle>
                {result.status === "existing"
                  ? "Already tracked"
                  : "Artist added"}
              </CardTitle>
            </div>
            {result.status === "existing" && (
              <CardDescription>
                This artist was already in your collection
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="grid gap-5">
            {/* Artist profile */}
            <div className="flex items-center gap-3.5">
              <Avatar className="size-14 text-lg">
                {result.artist.profilePicUrl && (
                  <AvatarImage
                    src={result.artist.profilePicUrl}
                    alt={
                      result.artist.displayName ||
                      result.artist.instagramHandle
                    }
                  />
                )}
                <AvatarFallback className="text-base">
                  {getInitials(
                    result.artist.displayName,
                    result.artist.instagramHandle
                  )}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium leading-snug">
                  {result.artist.displayName ||
                    result.artist.instagramHandle}
                </p>
                <p className="text-sm text-muted-foreground">
                  @{result.artist.instagramHandle}
                </p>
              </div>
            </div>

            {/* Locations */}
            {result.locations.length > 0 && (
              <div className="grid gap-2.5">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  Locations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {result.locations.map((loc) => (
                    <Badge
                      key={loc.id}
                      variant="secondary"
                      className={
                        loc.isPrimary
                          ? "border border-amber-500/30 bg-amber-500/10 text-amber-200"
                          : ""
                      }
                    >
                      {formatLocation(loc)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 &&
              result.warnings.map((warning, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-300"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>{warning}</span>
                </div>
              ))}
          </CardContent>

          <CardFooter className="gap-3">
            <Button variant="outline" onClick={reset}>
              <Plus className="h-3.5 w-3.5" />
              Add another
            </Button>
            <Button
              className="ml-auto"
              render={<Link href="/artists" />}
            >
              View artists
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardFooter>
        </Card>
      ) : view === "loading" ? (
        /* -------------------------------------------------------- */
        /*  Loading view                                             */
        /* -------------------------------------------------------- */
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <CardTitle>
              Adding @{handle}
            </CardTitle>
            <CardDescription>
              This usually takes a few seconds
            </CardDescription>
          </CardHeader>

          <CardContent>
            <ol className="grid gap-0" aria-label="Pipeline progress">
              {STEPS.map((label, i) => {
                const done = i < step
                const active = i === step
                const last = i === STEPS.length - 1

                return (
                  <li key={label} className="flex gap-3">
                    {/* Step indicator + connector */}
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 items-center justify-center">
                        {done ? (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                            <Check className="h-3 w-3 text-emerald-400" />
                          </span>
                        ) : active ? (
                          <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                        ) : (
                          <Circle className="h-2.5 w-2.5 fill-muted-foreground/20 text-muted-foreground/30" />
                        )}
                      </span>
                      {!last && (
                        <span
                          aria-hidden
                          className={`my-1 h-4 w-px ${
                            done ? "bg-emerald-500/30" : "bg-border"
                          }`}
                        />
                      )}
                    </div>

                    {/* Label */}
                    <span
                      className={`pt-0.5 text-sm leading-6 ${
                        done
                          ? "text-muted-foreground"
                          : active
                            ? "font-medium text-foreground"
                            : "text-muted-foreground/40"
                      }`}
                    >
                      {label}
                    </span>
                  </li>
                )
              })}
            </ol>
          </CardContent>
        </Card>
      ) : (
        /* -------------------------------------------------------- */
        /*  Form view (idle / error)                                 */
        /* -------------------------------------------------------- */
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Add Artist
            </CardTitle>
            <CardDescription>
              Enter a tattoo artist&apos;s Instagram handle
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-4">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="handle">Instagram handle</Label>
                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground/50 select-none"
                  >
                    @
                  </span>
                  <Input
                    ref={inputRef}
                    id="handle"
                    type="text"
                    placeholder="artist_handle"
                    autoFocus
                    autoComplete="off"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    value={handle}
                    onChange={(e) => {
                      setHandle(stripAt(e.target.value))
                      if (error) setError(null)
                    }}
                    className="pl-7"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Add Artist
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
