import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

import { seeded } from "./random"

/* ═══════════════════════════════════════════════════════════════════════
   CSS chrome ornaments — cheap enough to scatter anywhere. Their light
   reads the global --mx/--my pointer vars (see pointer-vars.tsx), so they
   shimmer as the cursor moves without rotating. Styles live in
   globals.css (.spike-star, .thorn-row, .screw). Decorative only.
   ═══════════════════════════════════════════════════════════════════ */

function starPolygon(points: number, inner: number, jitter: number, seed: number, offset = 0) {
  const rnd = seeded(seed)
  const coords: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = ((i + offset) / (points * 2)) * Math.PI * 2
    const r = i % 2 === 0 ? 50 * (1 - jitter * rnd()) : 50 * inner
    coords.push(`${(50 + r * Math.sin(a)).toFixed(2)}% ${(50 - r * Math.cos(a)).toFixed(2)}%`)
  }
  return `polygon(${coords.join(",")})`
}

const STAR_TONES = {
  gun: ["#12171a", "#d5dee3", "#4b565d", "#0e1215", "#8796a0"],
  chrome: ["#2a3237", "#ffffff", "#8794a0", "#1b2125", "#c5d0d6"],
  ice: ["#0f1726", "#cfe4ff", "#3f6fae", "#0c121b", "#7fb0f0"],
  mint: ["#0d1a17", "#c8fff0", "#2f8f78", "#0b1513", "#6fe3c4"],
} as const

export type StarTone = keyof typeof STAR_TONES

/**
 * Faceted chrome starburst. Each spike has a lit and a shaded face; a
 * light sweeps around it with time and the pointer. Size it with `size-*`.
 */
export function SpikeStar({
  className,
  points = 12,
  inner = 0.3,
  jitter = 0.35,
  seed = 1,
  tone = "gun",
  back = true,
  core = true,
  style,
}: {
  className?: string
  points?: number
  inner?: number
  jitter?: number
  seed?: number
  tone?: StarTone
  back?: boolean
  core?: boolean
  style?: CSSProperties
}) {
  const [s0, s1, s2, s3, s4] = STAR_TONES[tone]
  const vars = {
    "--n": points,
    "--clip": starPolygon(points, inner, jitter, seed),
    "--clip-back": starPolygon(points, inner * 0.62, jitter * 0.4, seed + 3, 1),
    "--s0": s0,
    "--s1": s1,
    "--s2": s2,
    "--s3": s3,
    "--s4": s4,
    "--delay": `${(-seeded(seed + 9)() * 20).toFixed(2)}s`,
    ...style,
  } as CSSProperties

  return (
    <span aria-hidden="true" className={cn("spike-star", className)} style={vars}>
      {back && <span className="spike-star-back" />}
      <span className="spike-star-body" />
      <span className="spike-star-glint" />
      {core && <span className="spike-star-core" />}
    </span>
  )
}

/** Chrome rail fringed with thorns; `dir="up"` points them upward. */
export function ThornRow({
  className,
  dir = "down",
  height = 18,
}: {
  className?: string
  dir?: "up" | "down"
  height?: number
}) {
  return (
    <span
      aria-hidden="true"
      data-dir={dir}
      className={cn("thorn-row", className)}
      style={{ "--thorn-h": `${height}px` } as CSSProperties}
    >
      <span className="thorn-row-spikes" />
      <span className="thorn-row-rail" />
    </span>
  )
}

/** Four slotted screw heads in the corners of a positioned panel. */
export function Screws({ inset = 8, size = 7, className }: { inset?: number; size?: number; className?: string }) {
  const corners: CSSProperties[] = [
    { top: inset, left: inset, "--a": "25deg" } as CSSProperties,
    { top: inset, right: inset, "--a": "-40deg" } as CSSProperties,
    { bottom: inset, left: inset, "--a": "70deg" } as CSSProperties,
    { bottom: inset, right: inset, "--a": "-10deg" } as CSSProperties,
  ]
  return (
    <>
      {corners.map((pos, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("screw pointer-events-none", className)}
          style={{ ...pos, "--screw": `${size}px` } as CSSProperties}
        />
      ))}
    </>
  )
}
