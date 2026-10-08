import { randomBytes } from "node:crypto"
import { hash } from "bcryptjs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { isAdminEmail } from "@/lib/admin"

/* ------------------------------------------------------------------ */
/*  Types & errors                                                     */
/* ------------------------------------------------------------------ */

export const DEFAULT_INVITE_TTL_DAYS = 7
export const MAX_INVITE_TTL_DAYS = 90

export type InviteStatus = "valid" | "used" | "expired" | "revoked" | "invalid"

export class InviteError extends Error {
  constructor(public readonly status: Exclude<InviteStatus, "valid">) {
    super(INVITE_ERROR_MESSAGES[status])
    this.name = "InviteError"
  }
}

export class EmailTakenError extends Error {
  constructor() {
    super("A user with this email already exists")
    this.name = "EmailTakenError"
  }
}

const INVITE_ERROR_MESSAGES: Record<Exclude<InviteStatus, "valid">, string> = {
  invalid: "TravelInk is invite-only. Ask a member for an invite link.",
  used: "This invite link has already been used.",
  expired: "This invite link has expired. Ask for a new one.",
  revoked: "This invite link was revoked. Ask for a new one.",
}

/* ------------------------------------------------------------------ */
/*  Invites                                                            */
/* ------------------------------------------------------------------ */

function inviteStatus(invite: {
  usedAt: Date | null
  revokedAt: Date | null
  expiresAt: Date
} | null): InviteStatus {
  if (!invite) return "invalid"
  if (invite.usedAt) return "used"
  if (invite.revokedAt) return "revoked"
  if (invite.expiresAt <= new Date()) return "expired"
  return "valid"
}

export async function getInviteStatus(code: string): Promise<InviteStatus> {
  if (!code) return "invalid"
  const invite = await prisma.invite.findUnique({ where: { code } })
  return inviteStatus(invite)
}

export async function createInvite(
  createdById: string,
  options: { note?: string | null; expiresInDays?: number } = {},
) {
  const days = Math.min(
    Math.max(Math.round(options.expiresInDays ?? DEFAULT_INVITE_TTL_DAYS), 1),
    MAX_INVITE_TTL_DAYS,
  )
  return prisma.invite.create({
    data: {
      // 128 bits — not guessable
      code: randomBytes(16).toString("base64url"),
      note: options.note?.trim().slice(0, 200) || null,
      createdById,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    },
  })
}

/** Revoke an unused invite. Returns false if it doesn't exist or was already used. */
export async function revokeInvite(id: string): Promise<boolean> {
  const { count } = await prisma.invite.updateMany({
    where: { id, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return count > 0
}

export async function listInvites() {
  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      createdBy: { select: { email: true, name: true } },
      usedBy: { select: { email: true, name: true } },
    },
  })
  return invites.map((i) => ({
    id: i.id,
    code: i.code,
    note: i.note,
    status: inviteStatus(i),
    createdAt: i.createdAt.toISOString(),
    expiresAt: i.expiresAt.toISOString(),
    usedAt: i.usedAt?.toISOString() ?? null,
    createdBy: i.createdBy.email ?? i.createdBy.name,
    usedBy: i.usedBy ? (i.usedBy.email ?? i.usedBy.name) : null,
  }))
}

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a user. Requires a valid invite unless the email is an admin's
 * (ADMIN_EMAILS), which lets a fresh deployment bootstrap its first account.
 * The invite is consumed in the same transaction that creates the user.
 * @throws {InviteError}
 * @throws {EmailTakenError}
 */
export async function registerUser(input: {
  email: string
  password: string
  name?: string | null
  inviteCode?: string | null
}) {
  const inviteCode = input.inviteCode?.trim() || null
  const needsInvite = !isAdminEmail(input.email)

  // Fail fast before the (slow) bcrypt hash
  if (needsInvite) {
    const status = await getInviteStatus(inviteCode ?? "")
    if (status !== "valid") throw new InviteError(status)
  }
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new EmailTakenError()
  }

  const passwordHash = await hash(input.password, 12)

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.email, passwordHash, name: input.name || null },
      })
      if (needsInvite) {
        // Conditional update so two sign-ups racing on one link can't both win
        const { count } = await tx.invite.updateMany({
          where: {
            code: inviteCode!,
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedById: user.id, usedAt: new Date() },
        })
        if (count === 0) throw new InviteError("used")
      }
      return user
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailTakenError()
    }
    throw err
  }
}

/* ------------------------------------------------------------------ */
/*  Users (admin)                                                      */
/* ------------------------------------------------------------------ */

export async function listUsers() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      disabledAt: true,
      inviteUsed: { select: { createdBy: { select: { email: true, name: true } } } },
      _count: { select: { artists: true } },
    },
  })
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
    disabled: u.disabledAt !== null,
    isAdmin: isAdminEmail(u.email),
    invitedBy: u.inviteUsed
      ? (u.inviteUsed.createdBy.email ?? u.inviteUsed.createdBy.name)
      : null,
    artistCount: u._count.artists,
  }))
}

/**
 * Disable or re-enable a user. Disabling also revokes their unused invites.
 * Admins can't be disabled (remove them from ADMIN_EMAILS first).
 * @returns false if the user doesn't exist or is an admin
 */
export async function setUserDisabled(userId: string, disabled: boolean): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user || isAdminEmail(user.email)) return false

  const now = new Date()
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { disabledAt: disabled ? now : null } }),
    ...(disabled
      ? [
          prisma.invite.updateMany({
            where: { createdById: userId, usedAt: null, revokedAt: null },
            data: { revokedAt: now },
          }),
        ]
      : []),
  ])
  return true
}
