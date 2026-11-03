"use client"

import { useCallback, useSyncExternalStore } from "react"
import Link from "next/link"
import { ExternalLink, Puzzle, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useCurrentUserId } from "@/hooks/use-current-user-id"
import { EXTENSION_STORE_URL } from "@/lib/extension"

const DISMISSED_KEY_PREFIX = "travelink.extensionCardDismissed."
// Tells this tab's other cards when one is dismissed (the storage event only reaches other tabs).
const DISMISSED_EVENT = "travelink:extension-card-dismissed"

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener(DISMISSED_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(DISMISSED_EVENT, onChange)
  }
}

/** Whether the signed-in user has dismissed the card, per browser. Null until known. */
function useDismissed(): [boolean | null, () => void] {
  const userId = useCurrentUserId()
  const key = userId ? DISMISSED_KEY_PREFIX + userId : null
  const dismissed = useSyncExternalStore(
    subscribe,
    () => (key ? localStorage.getItem(key) === "1" : null),
    () => null,
  )
  const dismiss = useCallback(() => {
    if (!key) return
    localStorage.setItem(key, "1")
    window.dispatchEvent(new Event(DISMISSED_EVENT))
  }, [key])
  return [dismissed, dismiss]
}

function Step({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-semibold text-brand-300">
        {number}
      </span>
      <span className="pt-px leading-5">{children}</span>
    </li>
  )
}

export interface ExtensionCardProps {
  /** Shows a close button; once closed it stays hidden for this user in this browser. */
  dismissible?: boolean
}

/**
 * The browser extension, as the recommended way to add artists: an Add button on every Instagram
 * profile. Links to the store listing once it's live (EXTENSION_STORE_URL).
 */
export function ExtensionCard({ dismissible = false }: ExtensionCardProps) {
  const [dismissed, dismiss] = useDismissed()
  if (dismissible && dismissed !== false) return null

  const storeLink = EXTENSION_STORE_URL ? (
    <a href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer">
      <Button className="bg-brand-600 font-medium text-white hover:bg-brand-700">
        Get the extension
        <ExternalLink className="size-3.5" />
      </Button>
    </a>
  ) : (
    <span className="inline-flex items-center rounded-md border border-border/60 px-3 py-1.5 text-sm text-muted-foreground">
      Coming soon to the Chrome Web Store
    </span>
  )

  return (
    <section
      aria-labelledby="extension-card-title"
      className="relative w-full rounded-xl border border-brand-500/25 bg-brand-500/5 p-5 text-left shadow-2xl shadow-black/25"
    >
      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Hide the browser extension card"
          title="Hide"
        >
          <X className="size-4" />
        </button>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 ring-1 ring-brand-500/20">
          <Puzzle className="size-5 text-brand-400" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1 pr-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="extension-card-title" className="font-medium text-foreground">
                Add artists straight from Instagram
              </h2>
              <span className="rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[11px] font-medium text-brand-200">
                Recommended
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The travel-ink browser extension puts an <span className="text-foreground/80">Add</span>{" "}
              button on every Instagram profile, so you can add artists as you find them. No data
              export or session cookie needed.
            </p>
          </div>

          <ol className="grid gap-2 text-sm text-muted-foreground">
            <Step number={1}>
              Install the extension in Chrome, Edge or Brave on your computer
            </Step>
            <Step number={2}>
              Open a tattoo artist&apos;s profile on{" "}
              <span className="text-foreground/80">instagram.com</span>
            </Step>
            <Step number={3}>
              Click <span className="text-foreground/80">Add @handle</span> at the bottom right. They&apos;re
              added to your list, and their bio and locations are read straight away
            </Step>
          </ol>

          <p className="text-xs text-muted-foreground/80">
            It only reads the address of the profile you&apos;re on: not your Instagram login, your
            messages or anything else on the page.{" "}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              Privacy policy
            </Link>
          </p>

          <div className={dismissible ? "pt-1 lg:hidden" : "pt-1"}>{storeLink}</div>
        </div>

        {/* The banner above the list has room for the link beside the steps on wide screens */}
        {dismissible && <div className="hidden shrink-0 self-center lg:block">{storeLink}</div>}
      </div>
    </section>
  )
}
