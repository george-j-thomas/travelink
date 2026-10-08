"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Cookie,
  Download,
  Loader2,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react"

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
import { Separator } from "@/components/ui/separator"
import { useBioQueue } from "@/components/bio-queue"
import { useCurrentUserId } from "@/hooks/use-current-user-id"
import { useInstagramCookie } from "@/hooks/use-instagram-cookie"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Step = "method" | "select"
type ImportSource = "upload" | "scrape"

interface FollowingAccount {
  username: string
  fullName: string | null
  profilePicUrl: string | null
  /** Missing/null when unknown: data exports and older drafts don't include it */
  isPrivate?: boolean | null
}

/** What earlier bio lookups (by any user) found out about an account. */
type KnownAccountType = "business" | "personal"
type AccountKind = KnownAccountType | "private"

/** The fetched list + checkboxes, kept in this browser so nothing is lost on navigation. */
interface ImportDraft {
  source: ImportSource
  accounts: FollowingAccount[]
  selected: string[]
  savedAt: number
}

/* ------------------------------------------------------------------ */
/*  Draft storage                                                      */
/* ------------------------------------------------------------------ */

const DRAFT_KEY_PREFIX = "travelink.importDraft."
const DRAFT_SAVE_DEBOUNCE_MS = 300

function readDraft(userId: string): ImportDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + userId)
    if (!raw) return null
    const draft = JSON.parse(raw) as ImportDraft
    return Array.isArray(draft.accounts) && draft.accounts.length > 0 ? draft : null
  } catch {
    return null
  }
}

function writeDraft(userId: string, draft: ImportDraft | null) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY_PREFIX + userId, JSON.stringify(draft))
    else localStorage.removeItem(DRAFT_KEY_PREFIX + userId)
  } catch {
    // Storage full or unavailable — the list just won't survive a reload
  }
}

/**
 * Business/Creator accounts can't be private, so "private" and "personal"
 * accounts have no bio Travelink can read. null: not known yet.
 */
function accountKind(
  account: FollowingAccount,
  knownTypes: Record<string, KnownAccountType>
): AccountKind | null {
  if (account.isPrivate) return "private"
  return knownTypes[account.username.toLowerCase()] ?? null
}

function isPersonalAccount(
  account: FollowingAccount,
  knownTypes: Record<string, KnownAccountType>
): boolean {
  const kind = accountKind(account, knownTypes)
  return kind === "private" || kind === "personal"
}

// Tattoo words in a few languages. No lookbehinds: Safari before 16.4 can't parse them.
const TATTOO_WORDS = new RegExp(
  [
    "tatt", // tattoo, tattooer, tatts
    "tatoo(?!ine)", // the common misspelling, not Tatooine
    "(?:^|[^s])tats(?![iu])", // tats, tatsbykim (not stats, Tatsuya, Tatsiana)
    "(?:^|[^a-z])ink", // ink, inkbyjane, jane.ink (not pink, think)
    "(?:^|[^a-z])ttt(?![a-z])", // jane.ttt (not mattt)
    "hand.{0,3}poke",
    "stick.{0,5}poke", // stick and poke, stick_n_poke
    "(?:^|[^s])tatu[aeo]", // tatuaje, tatuagem, tatuaggio, tatuaż, tatuering (not estatua)
    "tatau",
    "tatou", // tatouage, tatoueur
    "tatoe[aeë]", // tatoeage, tatoeëerder (not potatoes)
    "tatov", // tatovering, tatovør
    "tetov", // tetování, tetovaža, tetoválás
    "t(?:ä|ae?)towier", // tätowierer, taetowierer
    "d[öo]vme",
    "tebori",
    "irezumi",
    "тату",
    "타투",
    "タトゥ",
    "刺青",
    "纹身",
    "紋身",
  ].join("|"),
  "i"
)

/** A guess from the handle and name alone, used to list likely artists first. */
function looksLikeTattooArtist(account: FollowingAccount): boolean {
  return (
    TATTOO_WORDS.test(account.username) ||
    (!!account.fullName && TATTOO_WORDS.test(account.fullName))
  )
}

function formatSavedAt(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function CollapsibleInstructions({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        {open ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {open ? "Hide instructions" : "Show instructions"}
      </button>

      {open && (
        <ol className="mt-3 grid gap-2 text-sm text-muted-foreground">
          {children}
        </ol>
      )}
    </div>
  )
}

function InstructionStep({
  number,
  children,
}: {
  number: number
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-semibold text-brand-300">
        {number}
      </span>
      <span className="pt-px leading-5">{children}</span>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ImportArtistsPage() {
  const router = useRouter()
  const userId = useCurrentUserId()
  const { kick: startBioQueue } = useBioQueue()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

  // -- Step state
  const [step, setStep] = useState<Step>("method")

  // -- Method state
  const [sessionCookie, setSessionCookie] = useState("")
  const {
    cookie: savedCookie,
    save: saveCookie,
    clear: clearSavedCookie,
  } = useInstagramCookie()
  // A freshly pasted cookie wins over the one kept from earlier in this tab
  const cookie = sessionCookie.trim() || savedCookie
  const [isUploading, setIsUploading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // -- Select state
  const [source, setSource] = useState<ImportSource>("upload")
  const [accounts, setAccounts] = useState<FollowingAccount[]>([])
  const [trackedHandles, setTrackedHandles] = useState<Set<string>>(new Set())
  const [knownTypes, setKnownTypes] = useState<Record<string, KnownAccountType>>({})
  const [selectedHandles, setSelectedHandles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [hideTracked, setHideTracked] = useState(false)
  const [hidePersonal, setHidePersonal] = useState(true)
  const [restoredAt, setRestoredAt] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const restoreCheckedRef = useRef(false)

  /* ---------------------------------------------------------------- */
  /*  Fetch existing artists for cross-reference                       */
  /* ---------------------------------------------------------------- */

  const fetchTrackedHandles = useCallback(async (): Promise<Set<string>> => {
    try {
      const res = await fetch("/api/artists")
      if (res.status === 401) {
        router.push("/login")
        return new Set()
      }
      if (!res.ok) return new Set()
      const data = (await res.json()) as { instagramHandle: string }[]
      return new Set(data.map((a) => a.instagramHandle.toLowerCase()))
    } catch {
      return new Set()
    }
  }, [router])

  // Reads what's already in the DB — no Instagram calls
  const fetchKnownTypes = useCallback(
    async (list: FollowingAccount[]): Promise<Record<string, KnownAccountType>> => {
      try {
        const res = await fetch("/api/import/account-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handles: list.map((a) => a.username) }),
        })
        if (!res.ok) return {}
        const data = (await res.json()) as { types?: Record<string, KnownAccountType> }
        return data.types ?? {}
      } catch {
        return {}
      }
    },
    []
  )

  /* ---------------------------------------------------------------- */
  /*  Draft: restore once, then autosave                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!userId || restoreCheckedRef.current) return
    restoreCheckedRef.current = true
    const draft = readDraft(userId)
    if (!draft) return

    void Promise.all([
      fetchTrackedHandles(),
      fetchKnownTypes(draft.accounts),
    ]).then(([tracked, types]) => {
      setTrackedHandles(tracked)
      setKnownTypes(types)
      setSource(draft.source)
      setAccounts(draft.accounts)
      setSelectedHandles(
        new Set(draft.selected.filter((h) => !tracked.has(h.toLowerCase())))
      )
      setRestoredAt(draft.savedAt)
      setStep("select")
    })
  }, [userId, fetchTrackedHandles, fetchKnownTypes])

  useEffect(() => {
    if (!userId || step !== "select" || accounts.length === 0) return
    const timer = setTimeout(() => {
      writeDraft(userId, {
        source,
        accounts,
        selected: [...selectedHandles],
        savedAt: Date.now(),
      })
    }, DRAFT_SAVE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [userId, step, source, accounts, selectedHandles])

  function startOver() {
    if (userId) writeDraft(userId, null)
    setStep("method")
    setAccounts([])
    setSelectedHandles(new Set())
    setTrackedHandles(new Set())
    setKnownTypes({})
    setSearchQuery("")
    setRestoredAt(null)
    setNotice(null)
    setError(null)
  }

  /* ---------------------------------------------------------------- */
  /*  Transition to Select step                                        */
  /* ---------------------------------------------------------------- */

  async function goToSelect(list: FollowingAccount[], from: ImportSource) {
    const [tracked, types] = await Promise.all([
      fetchTrackedHandles(),
      fetchKnownTypes(list),
    ])
    setTrackedHandles(tracked)
    setKnownTypes(types)
    setSource(from)
    setAccounts(list)
    // Nothing pre-selected: most accounts people follow aren't tattoo artists
    setSelectedHandles(new Set())
    setRestoredAt(null)
    setNotice(null)
    setStep("select")
  }

  /* ---------------------------------------------------------------- */
  /*  File upload handler                                               */
  /* ---------------------------------------------------------------- */

  async function handleFile(file: File) {
    setError(null)

    if (!file.name.endsWith(".json")) {
      setError("Please upload a .json file")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large (max 10 MB)")
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/import/upload", {
        method: "POST",
        body: formData,
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to parse file")
        return
      }

      await goToSelect(data.accounts as FollowingAccount[], "upload")
    } catch {
      setError("Network error — check your connection and try again")
    } finally {
      setIsUploading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  /* ---------------------------------------------------------------- */
  /*  Drag-and-drop handlers                                           */
  /* ---------------------------------------------------------------- */

  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(true)
  }

  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  /* ---------------------------------------------------------------- */
  /*  Cookie fetch handler                                              */
  /* ---------------------------------------------------------------- */

  async function handleCookieFetch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!cookie) {
      setError("Please enter your session cookie")
      return
    }

    setIsFetching(true)

    try {
      const res = await fetch("/api/import/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: cookie, ownerId: userId }),
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json()

      if (!res.ok) {
        if (data.code === "instagram_session" && cookie === savedCookie) {
          clearSavedCookie()
        }
        setError(
          res.status === 429
            ? "Rate limited — please try again in a few minutes"
            : data.error || "Failed to fetch following list"
        )
        return
      }

      saveCookie(cookie)
      setSessionCookie("")
      await goToSelect(data.accounts as FollowingAccount[], "scrape")
    } catch {
      setError("Network error — check your connection and try again")
    } finally {
      setIsFetching(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Selection helpers                                                 */
  /* ---------------------------------------------------------------- */

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, "")
    return accounts.filter((a) => {
      const isTracked = trackedHandles.has(a.username.toLowerCase())
      if (hideTracked && isTracked) return false
      // Added accounts are left to "Hide added"
      if (hidePersonal && !isTracked && isPersonalAccount(a, knownTypes)) return false
      if (!q) return true
      return (
        a.username.toLowerCase().includes(q) ||
        (a.fullName?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [accounts, searchQuery, hideTracked, hidePersonal, trackedHandles, knownTypes])

  // Likely tattoo artists go first; each group keeps Instagram's order
  const [likelyAccounts, otherAccounts] = useMemo(() => {
    const likely: FollowingAccount[] = []
    const other: FollowingAccount[] = []
    for (const a of filteredAccounts) (looksLikeTattooArtist(a) ? likely : other).push(a)
    return [likely, other]
  }, [filteredAccounts])

  const selectableHandles = filteredAccounts
    .map((a) => a.username)
    .filter((h) => !trackedHandles.has(h.toLowerCase()))

  const allVisibleSelected =
    selectableHandles.length > 0 &&
    selectableHandles.every((h) => selectedHandles.has(h))

  const selectableLikelyHandles = likelyAccounts
    .map((a) => a.username)
    .filter((h) => !trackedHandles.has(h.toLowerCase()))

  const allLikelySelected =
    selectableLikelyHandles.length > 0 &&
    selectableLikelyHandles.every((h) => selectedHandles.has(h))

  const trackedCount = accounts.filter((a) =>
    trackedHandles.has(a.username.toLowerCase())
  ).length

  const personalCount = accounts.filter(
    (a) =>
      !trackedHandles.has(a.username.toLowerCase()) &&
      isPersonalAccount(a, knownTypes)
  ).length

  // Scraped lists say which accounts are private; data exports (and older drafts) don't
  const knowsPrivateStatus = accounts.some((a) => typeof a.isPrivate === "boolean")

  function toggleHandle(handle: string) {
    setNotice(null)
    setSelectedHandles((prev) => {
      const next = new Set(prev)
      if (next.has(handle)) {
        next.delete(handle)
      } else {
        next.add(handle)
      }
      return next
    })
  }

  function setHandlesSelected(handles: string[], selected: boolean) {
    setSelectedHandles((prev) => {
      const next = new Set(prev)
      if (selected) handles.forEach((h) => next.add(h))
      else handles.forEach((h) => next.delete(h))
      return next
    })
  }

  function renderAccountRow(account: FollowingAccount) {
    const handle = account.username
    const isTracked = trackedHandles.has(handle.toLowerCase())
    const isSelected = selectedHandles.has(handle)
    const kind = isTracked ? null : accountKind(account, knownTypes)

    return (
      <label
        key={handle}
        role="listitem"
        className={`flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors ${
          isTracked
            ? "opacity-50"
            : isSelected
              ? "bg-brand-500/5"
              : "hover:bg-muted/30"
        }`}
      >
        <input
          type="checkbox"
          checked={isTracked || isSelected}
          disabled={isTracked}
          onChange={() => toggleHandle(handle)}
          className="h-4 w-4 shrink-0 rounded border-border accent-brand-600"
          aria-label={`@${handle}`}
        />
        <span className="min-w-0 truncate text-sm">
          <span className="text-foreground">@{handle}</span>
          {account.fullName && (
            <span className="ml-2 text-muted-foreground">
              {account.fullName}
            </span>
          )}
        </span>
        {kind === "business" && (
          <Badge
            variant="outline"
            title="A bio lookup found a public Business or Creator account"
            className="ml-auto shrink-0 border-brand-500/30 bg-brand-500/10 text-[11px] text-brand-200"
          >
            Business
          </Badge>
        )}
        {(kind === "private" || kind === "personal") && (
          <Badge
            variant="outline"
            title={
              kind === "private"
                ? "Private accounts can't be Business accounts, so there's no bio to read"
                : "A bio lookup found a personal account, so there's no bio to read"
            }
            className="ml-auto shrink-0 text-[11px] text-muted-foreground"
          >
            {kind === "private" ? "Private" : "Personal"}
          </Badge>
        )}
        {isTracked && (
          <Badge
            variant="secondary"
            className="ml-auto shrink-0 text-[11px]"
          >
            <Check className="mr-1 h-3 w-3" />
            Added
          </Badge>
        )}
      </label>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Save selection — no Instagram calls, bios are fetched afterwards  */
  /* ---------------------------------------------------------------- */

  async function saveSelected() {
    setError(null)
    setNotice(null)

    const chosen = accounts.filter((a) => selectedHandles.has(a.username))
    if (chosen.length === 0) {
      setError("Select at least one account to add")
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch("/api/artists/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: chosen }),
      })

      if (res.status === 401) {
        router.push("/login")
        return
      }

      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setError(
          (data?.error || "Couldn't save your selection") +
            " — it's still selected here, so you can try again."
        )
        return
      }

      const saved = new Set(chosen.map((a) => a.username.toLowerCase()))
      setTrackedHandles((prev) => new Set([...prev, ...saved]))
      setSelectedHandles(new Set())
      setNotice(
        `Saved ${chosen.length} ${chosen.length === 1 ? "artist" : "artists"}. ` +
          "Their bios are being fetched in the background — keep selecting, or head to your artists."
      )
      startBioQueue()
    } catch {
      setError("Network error — your selection is still here, so you can try again.")
    } finally {
      setIsSaving(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                            */
  /* ---------------------------------------------------------------- */

  return (
    <div className="mx-auto max-w-2xl pt-2 sm:pt-8">
      {/* Back link */}
      <Link
        href="/artists"
        className="group/back mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover/back:-translate-x-0.5" />
        Artists
      </Link>

            {/* ============================================================ */}
      {/*  Step 1 — Choose Method                                       */}
      {/* ============================================================ */}
      {step === "method" && (
        <>
          <h1 className="mb-6 text-xl font-semibold tracking-tight">
            Import Artists
          </h1>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Card A — Upload Data Export */}
            <Card className="border-border/50 shadow-2xl shadow-black/25">
              <CardHeader className="pb-3">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                  <Upload className="h-5 w-5 text-brand-300" />
                </div>
                <CardTitle className="text-base font-semibold">
                  Upload Data Export
                </CardTitle>
                <CardDescription className="text-[13px] leading-relaxed">
                  Download your data from Instagram Settings, then upload the
                  following.json file
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <CollapsibleInstructions>
                  <InstructionStep number={1}>
                    Go to Instagram → Settings → Accounts Center
                  </InstructionStep>
                  <InstructionStep number={2}>
                    Your Information and Permissions → Download Your Information
                  </InstructionStep>
                  <InstructionStep number={3}>
                    Request Download (select <strong>JSON</strong> format)
                  </InstructionStep>
                  <InstructionStep number={4}>
                    Wait for email, download zip, find{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                      connections/followers_and_following/following.json
                    </code>
                  </InstructionStep>
                </CollapsibleInstructions>

                <Separator />

                {/* Drag-and-drop zone */}
                <div
                  ref={dropZoneRef}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                    isDragOver
                      ? "border-brand-500/60 bg-brand-500/5"
                      : "border-border/60 hover:border-brand-500/40 hover:bg-brand-500/5"
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                  ) : (
                    <Download className="h-6 w-6 text-muted-foreground/60" />
                  )}
                  <p className="text-sm text-muted-foreground">
                    {isUploading
                      ? "Parsing file…"
                      : "Drop .json file here or click to browse"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={onFileChange}
                />
              </CardContent>
            </Card>

            {/* Card B — Paste Session Cookie */}
            <Card className="border-border/50 shadow-2xl shadow-black/25">
              <CardHeader className="pb-3">
                <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10">
                  <Cookie className="h-5 w-5 text-brand-300" />
                </div>
                <CardTitle className="text-base font-semibold">
                  Paste Session Cookie
                </CardTitle>
                <CardDescription className="text-[13px] leading-relaxed">
                  Pull your following list with your Instagram session cookie.
                  It&apos;s also used for artist search, never for fetching bios
                </CardDescription>
              </CardHeader>

              <CardContent className="grid gap-4">
                <CollapsibleInstructions>
                  <InstructionStep number={1}>
                    Open{" "}
                    <strong>instagram.com</strong> in your browser and make sure
                    you&apos;re logged in
                  </InstructionStep>
                  <InstructionStep number={2}>
                    Open DevTools (F12) → Application tab → Cookies →
                    instagram.com
                  </InstructionStep>
                  <InstructionStep number={3}>
                    Find the{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
                      sessionid
                    </code>{" "}
                    cookie and copy its value
                  </InstructionStep>
                </CollapsibleInstructions>

                <Separator />

                <form onSubmit={handleCookieFetch} className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="sessionCookie" className="text-[13px]">
                      Session cookie
                    </Label>
                    <Input
                      id="sessionCookie"
                      type="password"
                      placeholder={
                        savedCookie
                          ? "Using your saved session — paste to replace"
                          : "Paste sessionid value…"
                      }
                      autoComplete="off"
                      value={sessionCookie}
                      onChange={(e) => {
                        setSessionCookie(e.target.value)
                        if (error) setError(null)
                      }}
                      disabled={isFetching}
                    />
                    {savedCookie && (
                      <p className="text-xs text-muted-foreground">
                        Kept in this tab until you reload or close it, or sign out.{" "}
                        <button
                          type="button"
                          onClick={clearSavedCookie}
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          Forget it
                        </button>
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-brand-600 font-medium text-white hover:bg-brand-700"
                    disabled={isFetching || !cookie}
                  >
                    {isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {isFetching ? "Fetching…" : "Fetch Following List"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </>
      )}


      {/* ============================================================ */}
      {/*  Step 2 — Select accounts                                     */}
      {/* ============================================================ */}
      {step === "select" && (
        <Card className="border-border/50 shadow-2xl shadow-black/25">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-semibold tracking-tight">
                  Pick your artists
                </CardTitle>
                <CardDescription className="mt-1">
                  <span className="font-medium text-foreground">
                    {accounts.length}
                  </span>{" "}
                  accounts you follow
                  {trackedCount > 0 && <> · {trackedCount} already added</>}
                  {hidePersonal && personalCount > 0 && (
                    <> · {personalCount} personal hidden</>
                  )}
                  {restoredAt && (
                    <> · list from {formatSavedAt(restoredAt)}</>
                  )}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={startOver}
                className="shrink-0 text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Start over
              </Button>
            </div>
          </CardHeader>

          <CardContent className="grid gap-4">
            <p className="text-xs text-muted-foreground">
              Your list and checkboxes are kept in this browser, so you can
              leave and come back. Added artists are saved right away; their
              bios are fetched afterwards.
            </p>

            {error && (
              <div className="flex items-start gap-2.5 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {notice}{" "}
                  <Link href="/artists" className="font-medium underline underline-offset-2">
                    View artists
                  </Link>
                </span>
              </div>
            )}

            {/* Search + select all */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
                <Input
                  type="text"
                  placeholder="Filter by handle or name…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  aria-label="Filter accounts"
                />
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={hideTracked}
                    onChange={(e) => setHideTracked(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-brand-600"
                  />
                  Hide added
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={hidePersonal}
                    onChange={(e) => setHidePersonal(e.target.checked)}
                    className="h-4 w-4 rounded border-border accent-brand-600"
                  />
                  Hide personal
                </label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setHandlesSelected(selectableHandles, !allVisibleSelected)}
                disabled={selectableHandles.length === 0}
                className="shrink-0"
              >
                {allVisibleSelected ? "Deselect shown" : "Select shown"}
              </Button>
            </div>

            <p className="-mt-1 text-xs text-muted-foreground">
              Travelink can only read the bios of public Business and Creator
              accounts.{" "}
              {knowsPrivateStatus ? (
                <>
                  Hide personal hides private accounts and ones an earlier bio
                  lookup found to be personal. Instagram doesn&apos;t mark
                  business accounts in this list, so some personal ones still
                  show.
                </>
              ) : (
                <>
                  Hide personal hides accounts an earlier bio lookup found to be
                  personal. This list doesn&apos;t say which accounts are
                  private, so most personal ones still show. Fetching it with
                  your session cookie hides more.
                </>
              )}{" "}
              Accounts with a tattoo word in their handle or name (tattoo, tats,
              ink, tatuaje…) are listed first.
            </p>

            {/* Account list */}
            <div className="max-h-[420px] overflow-y-auto rounded-lg border border-border/40">
              {filteredAccounts.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No accounts match your filter
                </p>
              ) : likelyAccounts.length === 0 ? (
                <div
                  role="list"
                  aria-label="Accounts you follow"
                  className="divide-y divide-border/30"
                >
                  {otherAccounts.map(renderAccountRow)}
                </div>
              ) : (
                <>
                  <section>
                    <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border/30 bg-card px-4 py-1.5 text-xs">
                      <h2
                        className="font-medium text-brand-200"
                        title="Their handle or name has a tattoo word in it"
                      >
                        Likely tattoo artists
                      </h2>
                      <span className="text-muted-foreground">· {likelyAccounts.length}</span>
                      {selectableLikelyHandles.length > 0 && (
                        <Button
                          type="button"
                          variant="link"
                          size="xs"
                          onClick={() =>
                            setHandlesSelected(selectableLikelyHandles, !allLikelySelected)
                          }
                          className="ml-auto h-auto px-0 text-brand-400 hover:text-brand-300"
                          aria-label={`${allLikelySelected ? "Deselect all" : "Select all"} likely tattoo artists`}
                        >
                          {allLikelySelected ? "Deselect all" : "Select all"}
                        </Button>
                      )}
                    </div>
                    <div
                      role="list"
                      aria-label="Likely tattoo artists"
                      className="divide-y divide-border/30"
                    >
                      {likelyAccounts.map(renderAccountRow)}
                    </div>
                  </section>

                  {otherAccounts.length > 0 && (
                    <section className="border-t border-border/30">
                      <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-border/30 bg-card px-4 py-1.5 text-xs">
                        <h2 className="font-medium text-muted-foreground">Other accounts</h2>
                        <span className="text-muted-foreground/70">· {otherAccounts.length}</span>
                      </div>
                      <div
                        role="list"
                        aria-label="Other accounts"
                        className="divide-y divide-border/30"
                      >
                        {otherAccounts.map(renderAccountRow)}
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3 border-t border-border/30 bg-card/80 pt-4 sm:flex-row">
            <span className="text-sm text-muted-foreground sm:mr-auto">
              <span className="font-medium text-foreground">
                {selectedHandles.size}
              </span>{" "}
              selected
            </span>
            <Button
              onClick={saveSelected}
              disabled={selectedHandles.size === 0 || isSaving}
              className="w-full bg-brand-600 font-medium text-white hover:bg-brand-700 sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
              {isSaving
                ? "Saving…"
                : `Add ${selectedHandles.size || ""} to my artists`.replace("  ", " ")}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
