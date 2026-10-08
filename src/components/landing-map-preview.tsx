import type { CSSProperties } from "react";
import { ChevronRight, Globe, MapPin, Plane, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* Animated mock of the map page for the landing page. Pins pop in, routes draw from
   home bases to guest spots, then a city popup opens; guest spots keep pinging and
   the routes keep flowing. Positions are percentages of the panel, kept clear of the
   filter bar and the popup at each breakpoint's aspect ratio. */

const FILTERS = [
  { label: "All", icon: Globe },
  { label: "Home bases", icon: MapPin },
  { label: "Guest spots", icon: Plane },
];

const PINS: { x: number; y: number; guest?: boolean }[] = [
  { x: 10, y: 20 },
  { x: 22, y: 19, guest: true },
  { x: 52, y: 19 },
  { x: 68, y: 27 },
  { x: 91, y: 64, guest: true },
  { x: 78, y: 74 },
  { x: 14, y: 90 },
  { x: 64, y: 88, guest: true },
  { x: 88, y: 86 },
];
const GUEST_PINS = PINS.filter((pin) => pin.guest);

const CLUSTERS = [
  { count: 14, x: 84, y: 42, className: "size-11 bg-brand-600" },
  { count: 3, x: 40, y: 85, className: "size-9 bg-brand-500" },
];

/* In the SVG's 0–100 viewBox, so they line up with the pins */
const ROUTES = ["M52 19 Q37 25 22 19", "M84 42 Q95 48 91 64", "M40 85 Q52 97 64 88"];

const ARTISTS: { name: string; initials: string; handle: string; guest?: boolean }[] = [
  { name: "Mara Volk", initials: "MV", handle: "mara.volk.ink" },
  { name: "Juno Reyes", initials: "JR", handle: "junoreyes.tattoo", guest: true },
  { name: "Sasha K.", initials: "SK", handle: "sasha.k.flash" },
];

/* Entrance timeline, in ms */
const PANEL_AT = 150;
const PINS_AT = 450;
const CLUSTERS_AT = 1050;
const ROUTES_AT = 1300;
const POPUP_AT = 1500;
const HALOS_AT = 2600;

function delay(ms: number): CSSProperties {
  return { animationDelay: `${ms}ms` };
}

export function LandingMapPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[3/4] cursor-default select-none overflow-hidden rounded-xl bg-card shadow-2xl shadow-black/25 ring-1 ring-foreground/10 motion-safe:animate-rise sm:aspect-[4/3] lg:aspect-square xl:aspect-[4/3]"
      style={delay(PANEL_AT)}
    >
      <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--card))]" />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        className="pointer-events-none absolute inset-0 size-full"
      >
        <defs>
          {ROUTES.map((d, i) => (
            <mask
              key={d}
              id={`landing-route-${i}`}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="100"
              height="100"
            >
              {/* A wide stroke that draws in, revealing the dashed route under it */}
              <path
                d={d}
                stroke="white"
                strokeWidth={8}
                pathLength={1}
                strokeDasharray="1 1"
                className="motion-safe:animate-route-draw"
                style={delay(ROUTES_AT + i * 200)}
              />
            </mask>
          ))}
        </defs>
        {ROUTES.map((d, i) => (
          <path
            key={d}
            d={d}
            mask={`url(#landing-route-${i})`}
            strokeWidth={1.5}
            strokeDasharray="3 5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-guest-500/60 motion-safe:animate-route-flow"
          />
        ))}
      </svg>

      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border/50 bg-background/80 p-1 shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150">
        {FILTERS.map(({ label, icon: Icon }, i) => (
          <span
            key={label}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium sm:px-3 sm:text-sm",
              i === 0 ? "bg-brand-600 text-white shadow-sm" : "text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </span>
        ))}
      </div>

      {PINS.map((pin, i) => (
        <span
          key={`${pin.x}-${pin.y}`}
          className={cn(
            "absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/20 transition-transform duration-200 hover:scale-150 motion-safe:animate-pop",
            pin.guest ? "bg-guest-500" : "bg-brand-400",
          )}
          style={{ left: `${pin.x}%`, top: `${pin.y}%`, ...delay(PINS_AT + i * 70) }}
        >
          {pin.guest && (
            <span
              className="absolute inset-0 rounded-full bg-guest-500 opacity-0 motion-safe:animate-halo"
              style={delay(HALOS_AT + GUEST_PINS.indexOf(pin) * 1500)}
            />
          )}
        </span>
      ))}

      {CLUSTERS.map(({ count, x, y, className }, i) => (
        <span
          key={count}
          className={cn(
            "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-white ring-4 ring-brand-400/30 transition-transform duration-200 hover:scale-110 motion-safe:animate-pop",
            className,
          )}
          style={{ left: `${x}%`, top: `${y}%`, ...delay(CLUSTERS_AT + i * 120) }}
        >
          {count}
        </span>
      ))}

      {/* Opens just above the 3-artist cluster (top: 85%, 36px tall) */}
      <div
        className="absolute bottom-[calc(15%+26px)] left-[40%] w-60 -translate-x-1/2 overflow-hidden rounded-xl bg-background/95 shadow-2xl ring-1 ring-border/50 backdrop-blur-xl motion-safe:animate-rise"
        style={delay(POPUP_AT)}
      >
        <div className="flex items-start gap-3 border-b border-border/50 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug">Berlin, Germany</p>
            <p className="text-xs text-muted-foreground">{ARTISTS.length} artists</p>
          </div>
          <X className="size-4 text-muted-foreground" />
        </div>
        <ul className="py-1">
          {ARTISTS.map(({ name, initials, handle, guest }) => (
            <li
              key={handle}
              className="group flex items-center gap-3 px-3.5 py-2 transition-colors hover:bg-muted/40"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-400">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium leading-snug transition-colors group-hover:text-brand-300">
                    {name}
                  </span>
                  {guest && <Plane className="size-3 shrink-0 text-guest-500" />}
                </div>
                <span className="block truncate text-xs text-muted-foreground">@{handle}</span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-brand-300" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
