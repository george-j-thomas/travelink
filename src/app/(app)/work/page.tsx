"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ExternalLink,
  Images,
  Loader2,
  RefreshCw,
  UserRound,
} from "lucide-react"

import { Button } from "@/components/ui/button"

/* ═══════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

interface MediaPost {
  id: string
  imageUrl: string
  permalink: string
  caption: string | null
  mediaType: string
  takenAt: string
  artist: {
    id: string
    instagramHandle: string
    displayName: string | null
    profilePicUrl: string | null
  }
}

type FetchNextResponse =
  | { status: "processed"; outcome: string; handle: string | null; remaining: number; nextDelayMs: number }
  | { status: "idle"; remaining: number }
  | { status: "busy"; remaining: number; nextDelayMs: number }
  | { status: "rate_limited"; remaining: number; retryAfterMs: number; message: string }
  | { status: "not_configured"; remaining: number; message: string }

/* ═══════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

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
   Post tile
   ═══════════════════════════════════════════════════════════════════ */

function PostTile({ post }: { post: MediaPost }) {
  const name = post.artist.displayName || post.artist.instagramHandle

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative mb-4 block break-inside-avoid overflow-hidden rounded-xl border border-border/50 bg-muted shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`${name}'s post on Instagram`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.imageUrl}
        alt={post.caption ?? `Post by @${post.artist.instagramHandle}`}
        loading="lazy"
        className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
      />

      {/* Gradient + artist overlay */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/0 to-black/0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="flex items-center gap-2 p-3">
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-500/20 text-[10px] font-semibold text-amber-200">
            {post.artist.profilePicUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.artist.profilePicUrl}
                alt=""
                className="size-7 rounded-full object-cover"
              />
            ) : (
              getInitials(name)
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {name}
          </span>
          <ExternalLink className="size-3.5 shrink-0 text-white/80" />
        </div>
      </div>
    </a>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   States
   ═══════════════════════════════════════════════════════════════════ */

function GridSkeleton() {
  const heights = ["h-48", "h-64", "h-56", "h-72", "h-52", "h-60", "h-44", "h-68"]
  return (
    <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className={`mb-4 break-inside-avoid animate-pulse rounded-xl bg-muted ${heights[i % heights.length]}`}
        />
      ))}
    </div>
  )
}

function EmptyState({ fetching }: { fetching: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
        <Images className="size-10 text-amber-500/80" strokeWidth={1.5} />
      </div>

      {fetching ? (
        <>
          <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
            <Loader2 className="size-4 animate-spin text-amber-500" />
            Gathering recent work…
          </h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            We&apos;re pulling the latest Instagram posts from your artists. This
            can take a moment — posts appear here as they arrive.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-medium text-foreground">No recent work yet</h2>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Recent posts show up here once your artists&apos; bios have been
            fetched. Instagram only shares posts from public Business/Creator
            accounts.
          </p>
          <Link href="/artists" className="mt-6">
            <Button className="bg-amber-500 font-medium text-black hover:bg-amber-400">
              <UserRound className="size-4" />
              Go to your artists
            </Button>
          </Link>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════════ */

const MAX_CONSECUTIVE_FAILURES = 5
const FAILURE_RETRY_MS = 30_000

export default function WorkPage() {
  const [posts, setPosts] = useState<MediaPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [remaining, setRemaining] = useState(0)

  const runningRef = useRef(false)
  const activeRef = useRef(true)
  const wakeRef = useRef<(() => void) | null>(null)

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/media")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as MediaPost[]
      setPosts(data)
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const sleep = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(done, ms)
        function done() {
          clearTimeout(timer)
          wakeRef.current = null
          resolve()
        }
        wakeRef.current = done
      }),
    [],
  )

  // Browser-driven media queue: fill/refresh posts one artist at a time.
  const runQueue = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    let failures = 0

    try {
      while (activeRef.current) {
        let data: FetchNextResponse
        try {
          const res = await fetch("/api/media/fetch-next", { method: "POST" })
          if (res.status === 401) return
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          data = (await res.json()) as FetchNextResponse
        } catch {
          failures++
          if (failures >= MAX_CONSECUTIVE_FAILURES) {
            setFetching(false)
            return
          }
          await sleep(FAILURE_RETRY_MS)
          continue
        }
        failures = 0

        switch (data.status) {
          case "processed": {
            setRemaining(data.remaining)
            setFetching(data.remaining > 0)
            // New posts may have landed — refresh the feed
            if (data.outcome === "fetched") await loadFeed()
            if (data.remaining === 0) return
            await sleep(data.nextDelayMs)
            break
          }
          case "busy":
            setRemaining(data.remaining)
            setFetching(true)
            await sleep(data.nextDelayMs)
            break
          case "rate_limited":
            setRemaining(data.remaining)
            setFetching(true)
            await sleep(data.retryAfterMs)
            break
          case "not_configured":
          case "idle":
          default:
            setFetching(false)
            setRemaining(0)
            return
        }
      }
    } finally {
      runningRef.current = false
    }
  }, [sleep, loadFeed])

  useEffect(() => {
    activeRef.current = true
    void loadFeed()
    void runQueue()
    return () => {
      activeRef.current = false
      wakeRef.current?.()
    }
  }, [loadFeed, runQueue])

  const handleRefresh = useCallback(() => {
    setLoading(true)
    void loadFeed()
    void runQueue()
  }, [loadFeed, runQueue])

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Recent Work
            {!loading && posts.length > 0 && (
              <span className="ml-2 align-baseline text-base font-normal text-muted-foreground">
                ({posts.length})
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The latest Instagram posts from the artists you follow.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {fetching && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-amber-500" />
              {remaining > 0 ? `Updating · ${remaining} left` : "Updating…"}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10 ring-1 ring-destructive/20">
            <AlertCircle className="size-8 text-destructive" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-muted-foreground">
            Something went wrong loading recent work.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={handleRefresh}
          >
            <RefreshCw className="size-3.5" />
            Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <EmptyState fetching={fetching} />
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
          {posts.map((post) => (
            <PostTile key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
