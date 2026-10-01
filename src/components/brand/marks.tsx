import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

/* ═══════════════════════════════════════════════════════════════════════
   Brand graphics: the circuit-like routing lines behind hero sections and
   the chrome wordmark. Decorative: hidden from assistive tech.
   ═══════════════════════════════════════════════════════════════════ */

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

const PULSE_COLOURS = ["#1fe0b0", "#4f93f5", "#e4ecf0", "#52ddb9", "#88bcff"]

/**
 * Hairline "routing" lines with 45° bends, terminal dots and a few heavy
 * segments, with light pulses running along them in green, blue and
 * white (`pulses={false}` for static lines). Covers its positioned parent.
 */
export function RoutingLines({
  className,
  layout = "hero",
  pulses = true,
}: {
  className?: string
  layout?: keyof typeof ROUTING
  pulses?: boolean
}) {
  const { lines, heavy, dots } = ROUTING[layout]
  return (
    <svg
      viewBox="0 0 1200 700"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn("pointer-events-none absolute inset-0 size-full", className)}
    >
      <g strokeWidth="1">
        {lines.map((d, i) => (
          <path key={d} d={d} className="animate-draw" style={{ animationDelay: `${i * 90}ms` }} />
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
      {/* Light pulses: a soft wide pass under a bright thin core */}
      {pulses && [
        { width: 7, opacity: 0.22 },
        { width: 1.8, opacity: 1 },
      ].map(({ width, opacity }) => (
        <g key={width} strokeWidth={width} strokeLinecap="round" opacity={opacity}>
          {lines.map((d, i) => (
            <path
              key={d}
              d={d}
              pathLength={1000}
              stroke={PULSE_COLOURS[i % PULSE_COLOURS.length]}
              className="animate-route-pulse"
              style={
                {
                  "--pulse-dur": `${5 + ((i * 7) % 6)}s`,
                  animationDelay: `${-((i * 2.3) % 9)}s`,
                } as CSSProperties
              }
            />
          ))}
        </g>
      ))}
    </svg>
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

/** Wordmark: "travel" in steel chrome, "ink" in green-to-blue chrome. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex select-none items-start font-display text-lg leading-none lowercase [--ink:0.085em]", className)}>
      <span className="text-chrome">travel</span>
      <span className="text-chrome-brand">ink</span>
      <Reg className="ml-0.5 align-top text-[0.42em] text-gun-200" />
    </span>
  )
}
