// Bulk import runner.
//
// Imports are driven by the browser: the client calls processNextHandle() via
// POST /api/import/[id]/next, waits `nextDelayMs`, and repeats. Nothing runs in
// the background, so this works on serverless hosts (Vercel) and the Instagram
// session cookie is only ever held for the duration of a single request.

import type { ImportJob } from "@prisma/client"
import { prisma } from "@/lib/db"
import { addArtistByHandle } from "@/lib/artist-pipeline"
import { RateLimitError } from "@/lib/instagram"
import {
  ScraperAuthError,
  ScraperRateLimitError,
  type ScraperCredentials,
} from "@/lib/instagram-scraper"

// ---------------------------------------------------------------------------
// Types & errors
// ---------------------------------------------------------------------------

export type ImportJobStatus = "pending" | "processing" | "completed" | "failed" | "cancelled"

export interface ImportJobState {
  id: string
  status: ImportJobStatus
  total: number
  completed: number
  failed: number
  skipped: number
  errors: { handle: string; error: string }[]
  currentHandle: string | null
}

export interface ProcessNextResult {
  job: ImportJobState
  /** How long the client should wait before calling again; null once the job has ended. */
  nextDelayMs: number | null
  /** True when the handle hit a rate limit and should be retried once after the delay. */
  retry: boolean
}

export class ImportJobNotFoundError extends Error {
  constructor() {
    super("Import job not found")
    this.name = "ImportJobNotFoundError"
  }
}

// ---------------------------------------------------------------------------
// Pacing
// ---------------------------------------------------------------------------

// Cookie scraping runs as the user's own Instagram account, so it is paced with
// jitter at ~120-180 profiles/hour — well under where Instagram starts throttling.
const SCRAPE_DELAY_MIN_MS = 20_000
const SCRAPE_DELAY_MAX_MS = 30_000
const SCRAPE_RATE_LIMIT_BACKOFF_MS = 5 * 60_000
const API_DELAY_MS = 1500
const API_RATE_LIMIT_BACKOFF_MS = 60_000

/** An active job with no progress for this long is treated as abandoned. */
export const STALE_JOB_THRESHOLD_MS = 10 * 60_000

const COOKIE_EXPIRED_ERROR =
  "Session cookie expired. Please restart the import with a fresh cookie."
const STILL_RATE_LIMITED_ERROR =
  "Instagram is still rate limiting after backing off — stopped to protect your account. Try again in a few hours."
const ACTIVE_STATUSES = ["pending", "processing"]

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function toState(job: ImportJob, currentHandle: string | null = null): ImportJobState {
  return {
    id: job.id,
    status: job.status as ImportJobStatus,
    total: job.totalHandles,
    completed: job.completed,
    failed: job.failed,
    skipped: job.skipped,
    errors: parseJsonArray(job.errors),
    currentHandle,
  }
}

function isActive(job: ImportJob): boolean {
  return ACTIVE_STATUSES.includes(job.status)
}

export function isStaleJob(job: ImportJob): boolean {
  return isActive(job) && Date.now() - job.updatedAt.getTime() > STALE_JOB_THRESHOLD_MS
}

async function findOwnedJob(jobId: string, userId: string): Promise<ImportJob> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } })
  if (!job || job.userId !== userId) throw new ImportJobNotFoundError()
  return job
}

/** Marks an abandoned job (browser closed mid-import) as failed. */
export async function failStaleJob(job: ImportJob): Promise<ImportJob> {
  const errors = parseJsonArray<{ handle: string; error: string }>(job.errors)
  errors.push({ handle: "unknown", error: "Import was interrupted. Please try again." })
  return prisma.importJob.update({
    where: { id: job.id },
    data: { status: "failed", errors: JSON.stringify(errors) },
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getImportJob(jobId: string, userId: string): Promise<ImportJobState> {
  let job = await findOwnedJob(jobId, userId)
  if (isStaleJob(job)) job = await failStaleJob(job)
  return toState(job)
}

export async function cancelImportJob(jobId: string, userId: string): Promise<ImportJobState> {
  await findOwnedJob(jobId, userId)
  await prisma.importJob.updateMany({
    where: { id: jobId, status: { in: ACTIVE_STATUSES } },
    data: { status: "cancelled" },
  })
  return toState(await findOwnedJob(jobId, userId))
}

/**
 * Processes the next unprocessed handle of an import job and records the outcome.
 *
 * @param isRetry - true when retrying a handle that previously hit a rate limit
 */
export async function processNextHandle(
  jobId: string,
  userId: string,
  scraper: ScraperCredentials | undefined,
  isRetry: boolean
): Promise<ProcessNextResult> {
  const job = await findOwnedJob(jobId, userId)

  if (!isActive(job)) {
    return { job: toState(job), nextDelayMs: null, retry: false }
  }

  const handles = parseJsonArray<string>(job.handles)
  const index = job.completed + job.failed + job.skipped

  if (index >= handles.length) {
    const done = await prisma.importJob.update({
      where: { id: jobId },
      data: { status: "completed" },
    })
    return { job: toState(done), nextDelayMs: null, retry: false }
  }

  const handle = handles[index]
  const errors = parseJsonArray<{ handle: string; error: string }>(job.errors)
  let outcome: "completed" | "skipped" | "failed"
  let hitInstagram = true
  let fatal = false

  try {
    const result = await addArtistByHandle(handle, userId, scraper)
    if (result.status === "existing") {
      // Served from the DB — no Instagram request, so no need to wait
      outcome = "skipped"
      hitInstagram = false
    } else {
      outcome = "completed"
    }
  } catch (err) {
    outcome = "failed"
    if (err instanceof ScraperAuthError) {
      fatal = true
      errors.push({ handle, error: COOKIE_EXPIRED_ERROR })
    } else if (err instanceof RateLimitError || err instanceof ScraperRateLimitError) {
      if (!isRetry) {
        // Don't advance — back off and retry this handle once
        const touched = await prisma.importJob.update({
          where: { id: jobId },
          data: { status: "processing" },
        })
        return {
          job: toState(touched, handle),
          nextDelayMs: scraper ? SCRAPE_RATE_LIMIT_BACKOFF_MS : API_RATE_LIMIT_BACKOFF_MS,
          retry: true,
        }
      }
      // Still limited after backing off — pushing on is what gets accounts flagged
      fatal = true
      errors.push({ handle, error: STILL_RATE_LIMITED_ERROR })
    } else {
      errors.push({ handle, error: err instanceof Error ? err.message : String(err) })
    }
  }

  const finished = fatal || index + 1 >= handles.length

  // Counter match = optimistic lock, so a duplicate tab can't double-count a handle.
  // Status match means a cancel issued mid-request wins.
  await prisma.importJob.updateMany({
    where: {
      id: jobId,
      status: { in: ACTIVE_STATUSES },
      completed: job.completed,
      failed: job.failed,
      skipped: job.skipped,
    },
    data: {
      status: fatal ? "failed" : finished ? "completed" : "processing",
      completed: job.completed + (outcome === "completed" ? 1 : 0),
      skipped: job.skipped + (outcome === "skipped" ? 1 : 0),
      failed: job.failed + (outcome === "failed" ? 1 : 0),
      errors: JSON.stringify(errors),
    },
  })

  const latest = await findOwnedJob(jobId, userId)
  if (!isActive(latest)) {
    return { job: toState(latest), nextDelayMs: null, retry: false }
  }

  const nextDelayMs = !hitInstagram
    ? 0
    : scraper
      ? randomBetween(SCRAPE_DELAY_MIN_MS, SCRAPE_DELAY_MAX_MS)
      : API_DELAY_MS

  return { job: toState(latest, handle), nextDelayMs, retry: false }
}
