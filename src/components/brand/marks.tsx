import type { ReactNode, SVGProps } from "react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Techno marks — Wipeout / Designers Republic-style graphic furniture:
   chevrons, crosshairs, corner ticks, barcodes and HUD readouts.
   All decorative: hidden from assistive tech.
   ═══════════════════════════════════════════════════════════════════ */

type MarkProps = SVGProps<SVGSVGElement>

function mark(props: MarkProps) {
  return { "aria-hidden": true, focusable: false, ...props } as const
}

/** Row of hard-edged forward chevrons. */
export function Chevrons({ count = 3, ...props }: MarkProps & { count?: number }) {
  const w = 10
  return (
    <svg viewBox={`0 0 ${(count - 1) * w + 12} 16`} fill="currentColor" {...mark(props)}>
      {Array.from({ length: count }, (_, i) => (
        <path key={i} d={`M${i * w} 0h5l7 8-7 8h-5l7-8Z`} />
      ))}
    </svg>
  )
}

/** Registration crosshair: ring plus overshooting hairlines. */
export function Crosshair(props: MarkProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5" {...mark(props)}>
      <circle cx="20" cy="20" r="11" />
      <path d="M20 0v40M0 20h40" />
      <path d="M20 9a11 11 0 0 1 11 11H20Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

// Deterministic pseudo-random so barcodes render identically on server and client
function seeded(seed: number) {
  let t = seed
  return () => {
    t = (t * 9301 + 49297) % 233280
    return t / 233280
  }
}

/** Seeded barcode strip. */
export function Barcode({ seed = 7, bars = 34, ...props }: MarkProps & { seed?: number; bars?: number }) {
  const rand = seeded(seed)
  let x = 0
  const rects = Array.from({ length: bars }, () => {
    const w = 1 + Math.floor(rand() * 3)
    const gap = 1 + Math.floor(rand() * 2)
    const r = { x, w }
    x += w + gap
    return r
  })
  return (
    <svg viewBox={`0 0 ${x} 20`} preserveAspectRatio="none" fill="currentColor" {...mark(props)}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y="0" width={r.w} height="20" />
      ))}
    </svg>
  )
}

/** Four L-shaped corner brackets framing the nearest positioned parent. */
export function CornerTicks({ className, size = 10 }: { className?: string; size?: number }) {
  const s = { width: size, height: size }
  const base = "pointer-events-none absolute border-current"
  return (
    <span aria-hidden="true" className={cn("text-brand-500", className)}>
      <span style={s} className={cn(base, "top-0 left-0 border-t-2 border-l-2")} />
      <span style={s} className={cn(base, "top-0 right-0 border-t-2 border-r-2")} />
      <span style={s} className={cn(base, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span style={s} className={cn(base, "right-0 bottom-0 border-r-2 border-b-2")} />
    </span>
  )
}

/** Monospace HUD microcopy: serials, coordinates, system labels. */
export function Readout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono text-[0.6rem] leading-none uppercase tracking-[0.22em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Brand mark — "TRAVEL" in grey, "INK" knocked out of a sheared red block
   ═══════════════════════════════════════════════════════════════════ */

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex select-none items-center font-display text-sm leading-none font-extrabold uppercase italic",
        className,
      )}
    >
      <span className="tracking-[0.06em] text-muted-foreground">Travel</span>
      <span className="relative ml-[0.2em] px-[0.4em] py-[0.18em] tracking-[0.06em] text-black">
        <span aria-hidden="true" className="absolute inset-0 -skew-x-[20deg] bg-brand-500" />
        <span className="relative">Ink</span>
      </span>
    </span>
  )
}
