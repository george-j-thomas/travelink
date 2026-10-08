import { prisma } from "@/lib/db"

/**
 * Daily caps on metered API calls, counted in Postgres (serverless-safe).
 * Vendor-side caps (prepaid balances) are the backstop; these stop a bug or a
 * misbehaving user from draining them in a day.
 *
 * - bio_fetch: one bio lookup + Claude parse + geocodes
 */
export const DAILY_LIMITS = {
  bio_fetch: { global: 1000, perUser: 500 },
} as const

export type UsageKind = keyof typeof DAILY_LIMITS

export class BudgetExceededError extends Error {
  constructor(
    public readonly kind: UsageKind,
    public readonly scope: "global" | "user",
    public readonly retryAfterMs: number,
  ) {
    super(
      scope === "user"
        ? "You've reached today's lookup limit. It resets at midnight UTC."
        : "TravelInk has reached today's lookup limit. It resets at midnight UTC.",
    )
    this.name = "BudgetExceededError"
  }
}

export function msUntilUtcMidnight(now = new Date()): number {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return midnight - now.getTime()
}

/**
 * Count one call against today's global and per-user limits, or throw without
 * counting anything. Call it right before the metered request.
 * @throws {BudgetExceededError}
 */
export async function reserveUsage(kind: UsageKind, userId: string): Promise<void> {
  const limits = DAILY_LIMITS[kind]
  await prisma.$transaction(async (tx) => {
    for (const [scope, limit] of [
      ["global", limits.global],
      [userId, limits.perUser],
    ] as const) {
      // Atomic increment that refuses to go past the limit (no row returned)
      const rows = await tx.$queryRaw<{ count: number }[]>`
        INSERT INTO api_usage (id, scope, user_id, kind, day, count)
        VALUES (gen_random_uuid()::text, ${scope}, ${scope === "global" ? null : userId},
                ${kind}, (now() AT TIME ZONE 'utc')::date, 1)
        ON CONFLICT (scope, kind, day)
        DO UPDATE SET count = api_usage.count + 1 WHERE api_usage.count < ${limit}
        RETURNING count`
      if (rows.length === 0) {
        throw new BudgetExceededError(kind, scope === "global" ? "global" : "user", msUntilUtcMidnight())
      }
    }
  })
}

/** Today's global counts vs limits, for the admin page. */
export async function getTodayUsage() {
  const rows = await prisma.$queryRaw<{ kind: string; count: number }[]>`
    SELECT kind, count FROM api_usage
    WHERE scope = 'global' AND day = (now() AT TIME ZONE 'utc')::date`
  return (Object.keys(DAILY_LIMITS) as UsageKind[]).map((kind) => ({
    kind,
    count: rows.find((r) => r.kind === kind)?.count ?? 0,
    limit: DAILY_LIMITS[kind].global,
    perUserLimit: DAILY_LIMITS[kind].perUser,
  }))
}
