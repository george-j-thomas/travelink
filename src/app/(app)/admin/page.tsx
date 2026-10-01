"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertCircle,
  Check,
  Copy,
  Gauge,
  Loader2,
  Plus,
  ShieldAlert,
  Ticket,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Invite {
  id: string
  code: string
  note: string | null
  status: "valid" | "used" | "expired" | "revoked"
  createdAt: string
  expiresAt: string
  usedAt: string | null
  createdBy: string | null
  usedBy: string | null
}

interface AdminUser {
  id: string
  email: string | null
  name: string | null
  createdAt: string
  disabled: boolean
  isAdmin: boolean
  invitedBy: string | null
  artistCount: number
}

interface UsageRow {
  kind: string
  count: number
  limit: number
  perUserLimit: number
}

const USAGE_LABELS: Record<string, string> = {
  bio_fetch: "Bio lookups",
}

const EXPIRY_OPTIONS = [1, 7, 30] as const

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" })
}

function inviteUrl(code: string): string {
  return `${window.location.origin}/?invite=${encodeURIComponent(code)}`
}

function InviteStatusBadge({ invite }: { invite: Invite }) {
  switch (invite.status) {
    case "valid":
      return (
        <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
          Open · expires {formatDate(invite.expiresAt)}
        </Badge>
      )
    case "used":
      return (
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
          Used by {invite.usedBy ?? "deleted user"}
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {invite.status === "expired" ? "Expired" : "Revoked"}
        </Badge>
      )
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy link"}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usage, setUsage] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [note, setNote] = useState("")
  const [expiresInDays, setExpiresInDays] = useState<number>(7)
  const [creating, setCreating] = useState(false)
  const [newInvite, setNewInvite] = useState<{ code: string; note: string } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [invRes, userRes, usageRes] = await Promise.all([
        fetch("/api/admin/invites"),
        fetch("/api/admin/users"),
        fetch("/api/admin/usage"),
      ])
      if ([invRes, userRes, usageRes].some((r) => r.status === 403)) {
        setForbidden(true)
        return
      }
      if (!invRes.ok || !userRes.ok || !usageRes.ok) throw new Error()
      setInvites(await invRes.json())
      setUsers(await userRes.json())
      setUsage(await usageRes.json())
    } catch {
      setError("Couldn't load admin data. Try reloading.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createInvite(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined, expiresInDays }),
      })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as { code: string }
      setNewInvite({ code: data.code, note: note.trim() })
      setNote("")
      await load()
    } catch {
      setError("Couldn't create the invite.")
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/invites/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError("Couldn't revoke the invite.")
    } finally {
      setBusyId(null)
    }
  }

  async function setDisabled(user: AdminUser, disabled: boolean) {
    if (
      disabled &&
      !confirm(`Disable ${user.email ?? user.name}? They'll be signed out and their open invites revoked.`)
    ) {
      return
    }
    setBusyId(user.id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      })
      if (!res.ok) throw new Error()
      await load()
    } catch {
      setError("Couldn't update the user.")
    } finally {
      setBusyId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="size-6 animate-spin text-amber-500" />
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">This page is for Travelink admins only.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Usage ── */}
      <Card className="border-border/50 shadow-2xl shadow-black/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="size-4 text-amber-500" />
            Today&apos;s usage
          </CardTitle>
          <CardDescription>Daily caps reset at midnight UTC.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {usage.map((u) => {
            const pct = Math.min(100, Math.round((u.count / u.limit) * 100))
            return (
              <div key={u.kind} className="grid gap-1.5 rounded-lg border border-border/50 p-3">
                <span className="text-xs text-muted-foreground">{USAGE_LABELS[u.kind] ?? u.kind}</span>
                <span className="text-sm font-medium">
                  {u.count} <span className="text-muted-foreground">/ {u.limit}</span>
                </span>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${pct >= 90 ? "bg-destructive" : "bg-amber-500"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{u.perUserLimit} per user</span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ── Invites ── */}
      <Card className="border-border/50 shadow-2xl shadow-black/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Ticket className="size-4 text-amber-500" />
            Invites
          </CardTitle>
          <CardDescription>
            Each link works once. Send it yourself — Travelink doesn&apos;t email anyone.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={createInvite} className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-48 flex-1 gap-1.5">
              <Label htmlFor="invite-note" className="text-xs">
                Who is it for? <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="invite-note"
                placeholder="e.g. Sam"
                maxLength={200}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={creating}
              />
            </div>
            <div className="grid gap-1.5">
              <span className="text-xs font-medium">Expires after</span>
              <div className="flex gap-1" role="radiogroup" aria-label="Expires after">
                {EXPIRY_OPTIONS.map((days) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={expiresInDays === days ? "secondary" : "ghost"}
                    role="radio"
                    aria-checked={expiresInDays === days}
                    onClick={() => setExpiresInDays(days)}
                  >
                    {days === 1 ? "1 day" : `${days} days`}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              type="submit"
              disabled={creating}
              className="bg-amber-500 text-black hover:bg-amber-400"
            >
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create invite
            </Button>
          </form>

          {newInvite && (
            <div className="grid gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-sm">
                Invite created{newInvite.note ? ` for ${newInvite.note}` : ""}. Send this link:
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 text-xs">
                  {inviteUrl(newInvite.code)}
                </code>
                <CopyButton text={inviteUrl(newInvite.code)} />
              </div>
            </div>
          )}

          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet.</p>
          ) : (
            <ul className="divide-y divide-border/50" aria-label="Invites">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm">{invite.note || "Unnamed invite"}</span>
                    <span className="text-xs text-muted-foreground">
                      Created {formatDate(invite.createdAt)} by {invite.createdBy ?? "unknown"}
                    </span>
                  </div>
                  <InviteStatusBadge invite={invite} />
                  {invite.status === "valid" && (
                    <>
                      <CopyButton text={inviteUrl(invite.code)} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        disabled={busyId === invite.id}
                        onClick={() => void revoke(invite.id)}
                      >
                        Revoke
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Users ── */}
      <Card className="border-border/50 shadow-2xl shadow-black/25">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-amber-500" />
            Users
          </CardTitle>
          <CardDescription>
            Disabling someone blocks their access and revokes their open invites.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border/50" aria-label="Users">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex items-center gap-2 truncate text-sm">
                    {user.email ?? user.name ?? user.id}
                    {user.isAdmin && (
                      <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                        Admin
                      </Badge>
                    )}
                    {user.disabled && (
                      <Badge variant="outline" className="text-destructive">
                        Disabled
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Joined {formatDate(user.createdAt)}
                    {user.invitedBy ? ` · invited by ${user.invitedBy}` : ""} · {user.artistCount}{" "}
                    {user.artistCount === 1 ? "artist" : "artists"}
                  </span>
                </div>
                {!user.isAdmin && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={user.disabled ? "" : "text-destructive hover:text-destructive"}
                    disabled={busyId === user.id}
                    onClick={() => void setDisabled(user, !user.disabled)}
                  >
                    {user.disabled ? "Re-enable" : "Disable"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
