import type { ReactNode, SVGProps } from "react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Metalheart-style graphic furniture: hairline routing lines, speed-line
   bands, tick rulers, label tags and circle glyphs — chrome etching over
   the dark theme. All decorative: hidden from assistive tech.
   ═══════════════════════════════════════════════════════════════════ */

type MarkProps = SVGProps<SVGSVGElement>

function mark(props: MarkProps) {
  return { "aria-hidden": true, focusable: false, ...props } as const
}

// Deterministic pseudo-random so generated marks match on server and client
function seeded(seed: number) {
  let t = seed
  return () => {
    t = (t * 9301 + 49297) % 233280
    return t / 233280
  }
}

/** Row of forward chevrons ▶▶▶. */
export function Chevrons({ count = 3, ...props }: MarkProps & { count?: number }) {
  const w = 11
  return (
    <svg viewBox={`0 0 ${(count - 1) * w + 10} 12`} fill="currentColor" {...mark(props)}>
      {Array.from({ length: count }, (_, i) => (
        <path key={i} d={`M${i * w} 0h4l6 6-6 6h-4l6-6Z`} />
      ))}
    </svg>
  )
}

/** Thin plus / registration mark. */
export function Plus(props: MarkProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" {...mark(props)}>
      <path d="M10 0v20M0 10h20" />
    </svg>
  )
}

/** Small filled warning triangle with a knocked-out "!". */
export function Warn(props: MarkProps) {
  return (
    <svg viewBox="0 0 24 21" {...mark(props)}>
      <path d="M12 0 24 21H0Z" fill="currentColor" />
      <path d="M11 7h2v7h-2zM11 16h2v2h-2z" fill="var(--background)" />
    </svg>
  )
}

const GLYPHS = {
  slash: <path d="M6.5 13.5l7-7" />,
  plus: <path d="M10 5.5v9M5.5 10h9" />,
  arrow: <path d="M5.5 10h9M11 6.5l3.5 3.5-3.5 3.5" />,
  split: <path d="M10 4v12M10 10l4-4" />,
  dots: (
    <g fill="currentColor" stroke="none">
      <circle cx="7" cy="10" r="1.4" />
      <circle cx="10" cy="10" r="1.4" />
      <circle cx="13" cy="10" r="1.4" />
    </g>
  ),
  half: <path d="M10 4a6 6 0 0 1 0 12Z" fill="currentColor" stroke="none" />,
} as const

export type GlyphKind = keyof typeof GLYPHS

/** Wipeout-style circular pictogram. */
export function Glyph({ kind, ...props }: MarkProps & { kind: GlyphKind }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" {...mark(props)}>
      <circle cx="10" cy="10" r="8.5" />
      {GLYPHS[kind]}
    </svg>
  )
}

type Routing = { lines: string[]; heavy: string[]; dots: [number, number][] }

// 1200×700 viewBox, scaled with "slice". Each layout keeps clear of the
// zone where that page puts its copy.
const ROUTING = {
  // Hero: avoids the left text column (x 120–600, y 55–590)
  hero: {
    lines: [
      "M560 -10v50l110 110h120l100 100v60",
      "M-10 660h180l40-40h220l60 60v60",
      "M1210 150h-130l-60 60",
      "M1210 560h-200l-90-90v-60",
      "M820 -10l60 60v80",
      "M70 -10v100l-80 80",
      "M-10 28h330l22 22h170l30-30h90",
      "M100 150v280l-30 30v250",
      "M300 710v-60h260l24-24h300l40 40h300",
      "M1100 -10v90l40 40h80",
      "M1210 330h-60l-30 30v200l-40 40",
      "M640 250v150l-24 24v120",
      "M1000 -10v40l-30 30h-110",
      "M40 300h40l20 20",
      "M700 520h130l30 30h120",
    ],
    heavy: ["M600 80l40 40", "M250 620h90", "M880 60v40", "M1150 560h-70", "M100 200v50", "M640 300v40", "M380 28h70", "M1120 380v60"],
    dots: [
      [890, 310],
      [1020, 210],
      [920, 410],
      [880, 130],
      [100, 430],
      [640, 400],
      [522, 50],
      [1140, 130],
      [830, 520],
      [584, 626],
    ]
  },
  // Frame: hugs the edges around a centred card (x 340–860 stays clear)
  frame: {
    lines: [
      "M-10 120h180l120 120v200l-80 80h-230",
      "M1210 160h-110l-90 90v190l90 90h110",
      "M260 -10v60l60 60",
      "M900 -10v40l80 80h240",
      "M200 710v-50l60-60h80",
      "M1000 710l-60-60v-40",
      "M-10 40h120l30 30h120",
      "M1210 640h-140l-30-30h-60",
      "M90 710v-120l40-40",
      "M1120 -10v70l-30 30",
    ],
    heavy: ["M290 300v60", "M1010 300v60", "M1030 110h60", "M150 70h40", "M1060 610h-40"],
    dots: [
      [320, 110],
      [340, 600],
      [940, 610],
      [270, 70],
      [130, 550],
      [1090, 90],
    ]
  },
  // Band: full-bleed section backdrop, busy everywhere (content sits on top)
  band: {
    lines: [
      "M-10 80h260l40 40h300l30-30h590",
      "M-10 620h400l50-50h220l40 40h510",
      "M160 -10v200l-40 40v480",
      "M1040 -10v160l40 40v520",
      "M560 -10v70l-30 30",
      "M700 710v-90l30-30h140",
      "M-10 350h60l30 30",
      "M1210 300h-50l-30 30v80",
    ],
    heavy: ["M300 120h80", "M120 400v60", "M1080 260v50", "M760 590h70"],
    dots: [
      [530, 100],
      [120, 230],
      [1080, 200],
      [870, 590],
      [90, 380],
    ]
  },
} satisfies Record<string, Routing>

/**
 * Hairline "routing" lines with 45° bends, terminal dots and a few heavy
 * segments — the RX / DR poster backdrop. Covers its positioned parent.
 */
export function RoutingLines({ className, layout = "hero" }: { className?: string; layout?: keyof typeof ROUTING }) {
  const { lines, heavy, dots } = ROUTING[layout]
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
      {...mark({})}
    >
      <g strokeWidth="1">
        {lines.map((d, i) => (
          <path key={d} d={d} className="animate-dr-draw" style={{ animationDelay: `${i * 90}ms` }} />
        ))}
      </g>
      <g strokeWidth="5" strokeLinecap="square">
        {heavy.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g fill="currentColor" stroke="none">
        {dots.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="3.5" />
        ))}
      </g>
    </svg>
  )
}

/** Glitchy horizontal speed lines, like the Wipeout cover band. */
export function SpeedLines({ seed = 3, rows = 26, ...props }: MarkProps & { seed?: number; rows?: number }) {
  const rand = seeded(seed)
  const rects: { x: number; y: number; w: number; h: number; o: number }[] = []
  for (let r = 0; r < rows; r++) {
    const y = r * 5
    let x = rand() * 40
    while (x < 600) {
      const w = 6 + rand() * (rand() > 0.7 ? 140 : 40)
      rects.push({ x, y, w, h: 2 + Math.round(rand() * 2), o: 0.35 + rand() * 0.65 })
      x += w + 4 + rand() * 30
    }
  }
  return (
    <svg viewBox={`0 0 600 ${rows * 5}`} preserveAspectRatio="none" fill="currentColor" {...mark(props)}>
      {rects.map((r, i) => (
        <rect key={i} x={r.x.toFixed(1)} y={r.y} width={r.w.toFixed(1)} height={r.h} opacity={r.o.toFixed(2)} />
      ))}
    </svg>
  )
}

/** Numbered tick ruler: -0.5 … G.0 */
export function Ruler({ className, labels = ["-0.5", "-0.4", "-0.3", "-0.2", "-0.1", "G.0"] }: { className?: string; labels?: string[] }) {
  return (
    <span aria-hidden="true" className={cn("inline-flex items-end font-mono text-[0.55rem] leading-none text-muted-foreground", className)}>
      {labels.map((l, i) => (
        <span key={l} className="flex w-11 flex-col items-start gap-1">
          <span className="pl-1">{l}</span>
          <span className={cn("flex h-2 w-full items-end border-l border-current", i === labels.length - 1 && "border-brand-500")}>
            <span className="ml-[50%] h-1 border-l border-current" />
          </span>
        </span>
      ))}
    </span>
  )
}

/** Outlined label tag with a small filled square, e.g. "▪ FILE UNDER: INK". */
export function Tag({ children, className, square = "bg-brand-500" }: { children: ReactNode; className?: string; square?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-[3px] border border-foreground/60 px-2 py-1 font-mono text-[0.6rem] leading-none uppercase tracking-[0.18em]",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0", square)} />
      {children}
    </span>
  )
}

/** Monospace microcopy: codes, coordinates, captions. */
export function Readout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[0.6rem] leading-none uppercase tracking-[0.2em] text-muted-foreground", className)}>
      {children}
    </span>
  )
}

/** Circular text stamp that slowly spins. `id` must be unique on the page. */
export function Stamp({ id, text, className, children }: { id: string; text: string; className?: string; children?: ReactNode }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex items-center justify-center", className)}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full animate-dr-spin">
        <defs>
          <path id={id} d="M50 50m-38 0a38 38 0 1 1 76 0a38 38 0 1 1-76 0" />
        </defs>
        <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="29" fill="none" stroke="currentColor" strokeWidth="0.75" />
        <text className="fill-current font-mono text-[8.4px] uppercase" letterSpacing="2.1">
          <textPath href={`#${id}`}>{text}</textPath>
        </text>
      </svg>
      {children}
    </span>
  )
}

/** Dot field fading from heavy to fine, left to right. */
export function Halftone({ cols = 22, rows = 9, ...props }: MarkProps & { cols?: number; rows?: number }) {
  return (
    <svg viewBox={`0 0 ${cols * 10} ${rows * 10}`} fill="currentColor" {...mark(props)}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const c = i % cols
        const r = Math.floor(i / cols)
        const rad = 3.6 * (1 - c / cols) + 0.4
        return <circle key={i} cx={c * 10 + 5 + (r % 2) * 5} cy={r * 10 + 5} r={rad.toFixed(2)} />
      })}
    </svg>
  )
}

/** Chrome disc cut by a wave band, green-rimmed, with content on the band. */
export function WaveDisc({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <span className={cn("relative inline-flex aspect-square items-center justify-center", className)}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" {...mark({})}>
        <defs>
          <radialGradient id="wavedisc-metal" cx="38%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#dfeeec" />
            <stop offset="34%" stopColor="#8a9a9c" />
            <stop offset="66%" stopColor="#3a4648" />
            <stop offset="100%" stopColor="#0c1416" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#wavedisc-metal)" />
        <circle cx="100" cy="100" r="97" fill="none" stroke="var(--color-brand-500)" strokeWidth="2" opacity="0.7" />
        <path
          d="M0 92C40 66 90 112 132 92s52-30 68-22v52c-22-6-42 14-74 24S48 132 0 146Z"
          className="fill-background"
          opacity="0.82"
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  )
}

/** Small circled ® */
export function Reg({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("inline-block align-super font-sans text-[0.32em] leading-none [-webkit-text-stroke:0]", className)}>
      ®
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   Brand mark — heavy Zen Dots "travel" in ink + "ink" in vermilion,
   finished with a poster-style ®
   ═══════════════════════════════════════════════════════════════════ */

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex select-none items-start font-display text-lg leading-none lowercase [--ink:0.085em]", className)}>
      <span className="text-foreground">travel</span>
      <span className="text-brand-500">ink</span>
      <Reg className="ml-0.5 align-top text-[0.42em] text-foreground" />
    </span>
  )
}
