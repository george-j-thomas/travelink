import { prisma } from "@/lib/db"
import { addArtistByHandle } from "@/lib/artist-pipeline"
import { RateLimitError } from "@/lib/instagram"
import {
  ScraperAuthError,
  ScraperRateLimitError,
  type ScraperCredentials,
} from "@/lib/instagram-scraper"

export interface ImportJobState {
  status: "pending" | "processing" | "completed" | "failed" | "cancelled"
  total: number
  completed: number
  failed: number
  skipped: number
  errors: { handle: string; error: string }[]
  currentHandle: string | null
}

type InternalJobState = ImportJobState & { cancelled: boolean }

const jobs = new Map<string, InternalJobState>()

// Auto-remove job from memory after 30 minutes
function scheduleCleanup(jobId: string): void {
  setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000)
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function randomBetween(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min))
}

// Cookie scraping runs as the user's own Instagram account, so it is paced with
// jitter at ~120-180 profiles/hour — well under where Instagram starts throttling.
const SCRAPE_DELAY_MIN_MS = 20_000
const SCRAPE_DELAY_MAX_MS = 30_000
const SCRAPE_RATE_LIMIT_BACKOFF_MS = 5 * 60_000
const API_DELAY_MS = 1500
const API_RATE_LIMIT_BACKOFF_MS = 60_000

async function updateDb(
  jobId: string,
  state: InternalJobState,
  isFinal: boolean
): Promise<void> {
  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: isFinal ? state.status : "processing",
      completed: state.completed,
      failed: state.failed,
      skipped: state.skipped,
      errors: JSON.stringify(state.errors),
    },
  })
}

export function startImportJob(
  jobId: string,
  handles: string[],
  userId: string,
  scraper?: ScraperCredentials
): void {
  const state: InternalJobState = {
    status: "pending",
    total: handles.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    currentHandle: null,
    cancelled: false,
  }

  jobs.set(jobId, state)

  // Fire-and-forget — do NOT await
  ;(async () => {
    try {
      state.status = "processing"
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: "processing" },
      })

      for (let i = 0; i < handles.length; i++) {
        if (state.cancelled) break

        const handle = handles[i]
        state.currentHandle = handle

        // Existing artists are served from the DB — no Instagram request, no delay
        let hitInstagram = true

        try {
          const result = await addArtistByHandle(handle, userId, scraper)

          if (result.status === "existing") {
            hitInstagram = false
            state.skipped++
          } else {
            // "created" or "updated" both count as completed
            state.completed++
          }
        } catch (err) {
          if (err instanceof ScraperAuthError) {
            // Cookie expired — fatal, stop the whole job
            state.failed++
            state.errors.push({
              handle,
              error: "Session cookie expired. Please restart the import with a fresh cookie.",
            })
            state.status = "failed"
            break
          } else if (err instanceof RateLimitError || err instanceof ScraperRateLimitError) {
            // Back off and retry once
            await sleep(scraper ? SCRAPE_RATE_LIMIT_BACKOFF_MS : API_RATE_LIMIT_BACKOFF_MS)
            if (state.cancelled) break

            try {
              const retryResult = await addArtistByHandle(handle, userId, scraper)
              if (retryResult.status === "existing") {
                state.skipped++
              } else {
                state.completed++
              }
            } catch (retryErr) {
              if (retryErr instanceof ScraperAuthError) {
                state.failed++
                state.errors.push({
                  handle,
                  error: "Session cookie expired. Please restart the import with a fresh cookie.",
                })
                state.status = "failed"
                break
              }
              state.failed++
              state.errors.push({
                handle,
                error:
                  retryErr instanceof Error
                    ? retryErr.message
                    : String(retryErr),
              })
            }
          } else {
            state.failed++
            state.errors.push({
              handle,
              error: err instanceof Error ? err.message : String(err),
            })
          }
        }

        // Batch DB update every 10 handles
        if ((i + 1) % 10 === 0) {
          await updateDb(jobId, state, false)
        }

        if (hitInstagram && i < handles.length - 1 && !state.cancelled) {
          await sleep(
            scraper
              ? randomBetween(SCRAPE_DELAY_MIN_MS, SCRAPE_DELAY_MAX_MS)
              : API_DELAY_MS
          )
        }
      }

      // Final state
      if (state.status === "failed") {
        // Already set by ScraperAuthError handler — keep it
      } else if (state.cancelled) {
        state.status = "cancelled"
      } else {
        state.status = "completed"
      }
    } catch (err) {
      state.status = "failed"
      state.errors.push({
        handle: state.currentHandle ?? "unknown",
        error: `Unrecoverable: ${err instanceof Error ? err.message : String(err)}`,
      })
    } finally {
      state.currentHandle = null
      await updateDb(jobId, state, true).catch((dbErr) => {
        console.error(`[import-runner] Failed to write final DB state for job ${jobId}:`, dbErr)
      })
      scheduleCleanup(jobId)
    }
  })()
}

export function getJobProgress(jobId: string): ImportJobState | null {
  const state = jobs.get(jobId)
  if (!state) return null

  // Return a snapshot without the internal `cancelled` flag
  return {
    status: state.status,
    total: state.total,
    completed: state.completed,
    failed: state.failed,
    skipped: state.skipped,
    errors: state.errors,
    currentHandle: state.currentHandle,
  }
}

export function cancelJob(jobId: string): void {
  const state = jobs.get(jobId)
  if (state) {
    state.cancelled = true
  }
}
