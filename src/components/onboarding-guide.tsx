"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Download, Cookie } from "lucide-react"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

/* ─────────────────────────────────────────────────────────────────────
   Step indicator (amber numbered circles)
   ───────────────────────────────────────────────────────────────── */

function Step({
  number,
  children,
}: {
  number: number
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-[11px] font-semibold text-amber-400">
        {number}
      </span>
      <span className="pt-px leading-5">{children}</span>
    </li>
  )
}

/* ─────────────────────────────────────────────────────────────────────
   OnboardingGuide
   ───────────────────────────────────────────────────────────────── */

export interface OnboardingGuideProps {
  /** Whether the guide starts expanded (default: false) */
  defaultOpen?: boolean
}

export function OnboardingGuide({ defaultOpen = false }: OnboardingGuideProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="w-full max-w-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        {open ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        How to get your Instagram data
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-border/50 bg-card/50 p-4">
          <Tabs defaultValue="data-export">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="data-export" className="gap-1.5 text-xs">
                <Download className="size-3.5" />
                Data Export
              </TabsTrigger>
              <TabsTrigger value="session-cookie" className="gap-1.5 text-xs">
                <Cookie className="size-3.5" />
                Session Cookie
              </TabsTrigger>
            </TabsList>

            {/* ── Data Export ── */}
            <TabsContent value="data-export">
              <p className="mb-3 text-xs font-medium text-amber-400/80">
                Recommended — no password sharing
              </p>
              <ol className="grid gap-2 text-sm text-muted-foreground">
                <Step number={1}>
                  Open Instagram → tap your profile → ⚙️&nbsp;
                  <span className="text-foreground/80">Settings</span>
                </Step>
                <Step number={2}>
                  Go to{" "}
                  <span className="text-foreground/80">
                    Accounts Center → Your Information and Permissions
                  </span>
                </Step>
                <Step number={3}>
                  Tap{" "}
                  <span className="text-foreground/80">
                    Download Your Information → Download or Transfer Information
                  </span>
                </Step>
                <Step number={4}>
                  Select your Instagram account, choose{" "}
                  <span className="text-foreground/80">
                    Some of your information
                  </span>
                </Step>
                <Step number={5}>
                  Select only{" "}
                  <span className="text-foreground/80">
                    Followers and Following
                  </span>{" "}
                  (keeps the download small)
                </Step>
                <Step number={6}>
                  Choose{" "}
                  <span className="text-foreground/80">JSON</span> format, then{" "}
                  <span className="text-foreground/80">Create files</span>
                </Step>
                <Step number={7}>
                  You&apos;ll get an email when it&apos;s ready (usually 5–15
                  min)
                </Step>
                <Step number={8}>
                  Download the zip, find{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-amber-400/90">
                    following.json
                  </code>
                </Step>
                <Step number={9}>Upload that file on the import page</Step>
              </ol>
            </TabsContent>

            {/* ── Session Cookie ── */}
            <TabsContent value="session-cookie">
              <p className="mb-3 text-xs font-medium text-amber-400/80">
                Instant — fetches your following list directly
              </p>
              <ol className="grid gap-2 text-sm text-muted-foreground">
                <Step number={1}>
                  Open{" "}
                  <span className="text-foreground/80">instagram.com</span> in
                  your browser and make sure you&apos;re logged in
                </Step>
                <Step number={2}>
                  Open DevTools:{" "}
                  <kbd className="rounded bg-muted px-1 py-0.5 text-xs text-foreground/80">
                    F12
                  </kbd>{" "}
                  (or right-click → Inspect)
                </Step>
                <Step number={3}>
                  Go to{" "}
                  <span className="text-foreground/80">
                    Application
                  </span>{" "}
                  tab →{" "}
                  <span className="text-foreground/80">Cookies</span> →{" "}
                  <span className="text-foreground/80">instagram.com</span>
                </Step>
                <Step number={4}>
                  Find the cookie named{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs text-amber-400/90">
                    sessionid
                  </code>{" "}
                  and copy its value
                </Step>
                <Step number={5}>Paste it on the import page</Step>
              </ol>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
