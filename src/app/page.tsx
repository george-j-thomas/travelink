import Link from "next/link";
import { redirect } from "next/navigation";
import { LocateFixed, Lock, MapPin, Plane, ScanText } from "lucide-react";

import { getSession } from "@/lib/auth";
import { InstagramIcon } from "@/components/icons/instagram";
import { cn } from "@/lib/utils";
import {
  Barcode,
  BrandMark,
  Chevrons,
  CornerTicks,
  Crosshair,
  Readout,
} from "@/components/brand/marks";

const MARQUEE = [
  "Home bases",
  "Guest spots",
  "Berlin",
  "Conventions",
  "Tokyo",
  "Walk-ins",
  "Lisbon",
  "Flash days",
  "Mexico City",
  "Books open",
];

const TICKER = [
  "Travelink",
  "Artist location system",
  "TRV-INK/01",
  "52.5200°N 13.4050°E",
  "Invite only",
  "35.6762°N 139.6503°E",
  "Bio → geo",
  "38.7223°N 9.1393°W",
];

const STEPS = [
  {
    icon: InstagramIcon,
    title: "Bring your follows",
    body: "Import the tattoo artists you already follow on Instagram, or add them one handle at a time.",
  },
  {
    icon: ScanText,
    title: "We read the bios",
    body: "Travelink reads each artist's bio and pulls out where they're based and where they're guesting next.",
  },
  {
    icon: MapPin,
    title: "See them on the map",
    body: "Every artist lands on one map. Plan your next piece around a trip, or catch them when they come to you.",
  },
];

const FEATURES = [
  {
    code: "MOD-A",
    icon: Plane,
    accent: "guest" as const,
    title: "Guest spot radar",
    body: "Guest spots show up in silver with their dates, so you can see who's passing through your city.",
  },
  {
    code: "MOD-B",
    icon: LocateFixed,
    accent: "brand" as const,
    title: "Near me",
    body: "One tap centres the map on you and shows which of your artists are within reach.",
  },
  {
    code: "MOD-C",
    icon: Lock,
    accent: "brand" as const,
    title: "Invite only",
    body: "Your list is yours. Travelink is a small, private crew. You join with an invite from a friend.",
  },
];

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/artists");

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      <div aria-hidden="true" className="h-1 bg-brand-500" />

      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="relative z-20 border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="Travelink home">
            <BrandMark className="text-base" />
          </Link>
          <Readout className="hidden md:block">
            Sys / artist location tracker <span className="text-brand-500">{"//"}</span> v1.0
          </Readout>
          <LoginButton size="sm" />
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 bottom-0 hidden font-display text-[16rem] leading-none font-black tracking-tighter uppercase select-none wx-outline [--stroke-c:oklch(1_0_0/6%)] lg:block"
        >
          Ink
        </span>

        <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-5 pt-14 pb-24 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pt-20 lg:pb-32">
          <div className="relative">
            <p className="animate-wx-rise flex items-center gap-3">
              <span className="size-2 bg-brand-500 animate-wx-blink" />
              <Readout className="text-foreground">Tattoo artist tracker</Readout>
              <span className="h-px w-16 bg-border" />
              <Readout>01</Readout>
            </p>

            <h1 className="mt-7 font-display text-[2.6rem] leading-[0.88] font-black tracking-tight uppercase sm:text-6xl lg:text-[4.6rem]">
              <span className="animate-wx-wipe block [animation-delay:60ms]">Your</span>
              <span className="animate-wx-wipe block wx-outline [--stroke-c:var(--color-foreground)] [animation-delay:160ms]">
                Artists
              </span>
              <span className="animate-wx-wipe flex items-center gap-3 text-brand-500 [animation-delay:260ms] sm:gap-4">
                Mapped
                <Chevrons count={3} className="h-[0.42em] w-auto" />
              </span>
            </h1>

            <p className="animate-wx-rise mt-8 max-w-md text-base leading-relaxed text-muted-foreground [animation-delay:380ms] sm:text-lg">
              The artists you love move around: new studios, guest spots,
              conventions. Travelink reads their Instagram bios and puts them all
              on one map, so you always know where to find them.
            </p>

            <div className="animate-wx-rise mt-10 flex flex-col items-start gap-6 [animation-delay:460ms] sm:flex-row sm:items-center">
              <LoginButton size="lg" />
              <InviteLink />
            </div>

            <dl className="animate-wx-rise mt-14 grid max-w-md grid-cols-3 border-t border-border [animation-delay:540ms]">
              {[
                ["Source", "Instagram"],
                ["Parse", "Bio → geo"],
                ["Access", "Invite"],
              ].map(([k, v]) => (
                <div key={k} className="border-r border-border pt-3 pr-3 last:border-r-0 [&:not(:first-child)]:pl-3">
                  <dt>
                    <Readout>{k}</Readout>
                  </dt>
                  <dd className="mt-2 font-display text-xs font-bold uppercase">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <HeroArt />
        </div>
      </section>

      {/* ── Marquee bands ───────────────────────────────────────── */}
      <div aria-hidden="true" className="relative z-10 border-y-2 border-black">
        <div className="overflow-hidden bg-brand-500 py-3 text-black">
          <div className="flex w-max animate-wx-marquee">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center">
                {MARQUEE.map((word) => (
                  <span
                    key={word}
                    className="flex items-center gap-5 pr-5 font-display text-base font-black whitespace-nowrap uppercase italic sm:text-xl"
                  >
                    {word}
                    <Chevrons count={2} className="h-3 w-auto" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden border-t-2 border-black bg-muted py-2">
          <div className="flex w-max animate-wx-marquee-reverse">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center">
                {TICKER.map((word) => (
                  <span key={word} className="flex items-center gap-4 pr-4 whitespace-nowrap">
                    <Readout>{word}</Readout>
                    <span className="size-1 bg-brand-500" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
        <SectionHeading index="02" kicker="Process" title="Three steps to your map" />

        <ol className="mt-14 grid border border-border md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="group relative overflow-hidden border-b border-border bg-card/60 p-7 last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-brand-500 transition-transform duration-300 group-hover:scale-x-100"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -bottom-6 font-display text-[7.5rem] leading-none font-black select-none wx-outline [--stroke-c:oklch(1_0_0/9%)]"
              >
                0{i + 1}
              </span>
              <div className="relative flex items-center justify-between">
                <div className="flex size-11 items-center justify-center bg-brand-500 text-black wx-cut [--cut:8px]">
                  <step.icon className="size-5" />
                </div>
                <Readout>
                  Step <span className="text-foreground">0{i + 1}</span>/03
                </Readout>
              </div>
              <h3 className="relative mt-8 font-display text-lg leading-tight font-extrabold uppercase">
                {step.title}
              </h3>
              <p className="relative mt-3 max-w-[30ch] text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="relative border-y border-border bg-card/40">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-white/[0.03] wx-hairlines" />
        <div className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-32">
          <SectionHeading index="03" kicker="Systems" title="Never miss a guest spot" />

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="relative bg-background p-6 wx-cut [--cut:20px]">
                <div
                  className={cn(
                    "absolute top-0 left-0 h-1 w-2/3",
                    f.accent === "guest" ? "bg-guest-400" : "bg-brand-500",
                  )}
                />
                <div className="flex items-start justify-between">
                  <f.icon
                    className={cn("size-6", f.accent === "guest" ? "text-guest-400" : "text-brand-500")}
                  />
                  <Readout>{f.code}</Readout>
                </div>
                <h3 className="mt-6 font-display text-base font-extrabold uppercase">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="h-3 text-brand-500 wx-hazard [--stripe:10px]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1.4fr_1fr] lg:items-end lg:py-32">
          <div>
            <Readout className="flex items-center gap-3">
              <span className="text-brand-500">04</span>
              <span className="h-px w-10 bg-border" />
              Final call
            </Readout>
            <h2 className="mt-6 font-display text-[1.9rem] leading-[0.92] font-black tracking-tight uppercase sm:text-5xl lg:text-6xl">
              Know where
              <br />
              your next
              <br />
              <span className="text-brand-500">tattoo</span> is
            </h2>
          </div>
          <div className="relative border-l-2 border-brand-500 pl-6">
            <p className="text-muted-foreground">
              Already have an account? Log in and pick up where you left off.
              Travelink is invite only, so ask a friend who&apos;s in.
            </p>
            <div className="mt-8 flex flex-col items-start gap-5">
              <LoginButton size="lg" />
              <InviteLink />
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-5 py-8 sm:flex-row sm:px-8">
          <BrandMark className="text-xs" />
          <Readout className="text-center">Built for people who travel for ink</Readout>
          <Barcode seed={42} className="h-5 w-24 text-muted-foreground/60" />
        </div>
      </footer>
    </div>
  );
}

/* ═══ Pieces ═════════════════════════════════════════════════════════ */

function LoginButton({ size }: { size: "sm" | "lg" }) {
  return (
    // Focus ring sits on the unclipped link; the slanted clip lives on the inner span
    <Link
      href="/login"
      className="group inline-flex focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground"
    >
      <span
        className={cn(
          "inline-flex items-center bg-brand-500 font-display font-black uppercase italic text-black transition-colors duration-150 wx-slant",
          "group-hover:bg-foreground group-active:bg-brand-600",
          size === "lg"
            ? "h-14 gap-4 px-10 text-base tracking-[0.08em] [--slant:14px]"
            : "h-9 gap-2.5 px-6 text-xs tracking-[0.08em] [--slant:9px]",
        )}
      >
        Log in
        <Chevrons
          count={size === "lg" ? 3 : 2}
          className={cn(
            "w-auto transition-transform duration-200 group-hover:translate-x-1",
            size === "lg" ? "h-3.5" : "h-2.5",
          )}
        />
      </span>
    </Link>
  );
}

function InviteLink() {
  return (
    <Link
      href="/register"
      className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      Got an invite?
      <span className="font-display text-xs font-bold text-foreground uppercase underline decoration-brand-500 decoration-2 underline-offset-[6px] group-hover:text-brand-400">
        Create your account
      </span>
    </Link>
  );
}

function SectionHeading({ index, kicker, title }: { index: string; kicker: string; title: string }) {
  return (
    <div>
      <div className="flex items-end gap-5">
        <span
          aria-hidden="true"
          className="font-display text-6xl leading-[0.8] font-black wx-outline [--stroke-c:var(--color-brand-500)] sm:text-7xl"
        >
          {index}
        </span>
        <div>
          <Readout className="text-brand-500">{kicker}</Readout>
          <h2 className="mt-2 font-display text-2xl leading-none font-black tracking-tight uppercase sm:text-4xl">
            {title}
          </h2>
        </div>
      </div>
      <div aria-hidden="true" className="mt-6 flex h-px">
        <span className="w-24 bg-brand-500" />
        <span className="flex-1 bg-border" />
      </div>
    </div>
  );
}

const MOCK_PINS = [
  { x: "20%", y: "36%", kind: "home" },
  { x: "50%", y: "40%", kind: "cluster", n: 6 },
  { x: "62%", y: "64%", kind: "guest" },
  { x: "78%", y: "30%", kind: "home" },
  { x: "32%", y: "70%", kind: "guest" },
  { x: "86%", y: "72%", kind: "home" },
] as const;

const MOCK_LIST = [
  { name: "Mara Volk", handle: "mara.ink", kind: "home" },
  { name: "Juno Reyes", handle: "junotattoo", kind: "guest" },
  { name: "Sasha K.", handle: "sashaflash", kind: "home" },
] as const;

/** Decorative product mock: HUD-style map panel plus a cluster list readout. */
function HeroArt() {
  return (
    <div aria-hidden="true" className="animate-wx-rise relative mx-auto w-full max-w-[480px] pb-14 [animation-delay:300ms]">
      <Chevrons count={5} className="absolute -top-7 left-0 h-3 w-auto text-brand-500" />
      <Readout className="absolute -top-6 right-0">Fig. 01 / map.view</Readout>

      {/* Map panel */}
      <div className="relative">
        <div className="absolute inset-0 translate-x-3 translate-y-3 bg-brand-500 wx-cut [--cut:28px]" />
        <div className="relative aspect-[4/3] overflow-hidden bg-[#0e0e0e] wx-cut [--cut:28px]">
          <div className="absolute inset-0 text-white/[0.07] wx-grid [--grid:24px]" />
          <svg viewBox="0 0 400 300" className="absolute inset-0 size-full" fill="none">
            <path d="M-10 220C50 200 80 240 150 214s120-100 190-80 80 36 80 36" stroke="#262626" strokeWidth="20" />
            <g stroke="#3a3a3a" strokeWidth="1.5">
              <path d="M0 90h400M0 168h400M90 0v300M210 0v300M320 0v300" />
              <path d="M0 10l290 290M140 0l260 260" opacity=".7" />
            </g>
          </svg>

          {/* Sweep line */}
          <div className="absolute inset-x-0 h-px bg-brand-500/80 shadow-[0_0_12px_2px_rgb(238_28_37/0.5)] animate-wx-sweep" />

          {MOCK_PINS.map((p, i) => (
            <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
              {p.kind === "cluster" ? (
                <span className="relative flex size-20 items-center justify-center">
                  <Crosshair className="absolute inset-0 size-full text-brand-500/70" />
                  <span className="relative flex size-9 items-center justify-center border-2 border-brand-500 bg-black font-display text-sm font-black text-white">
                    06
                  </span>
                </span>
              ) : (
                <span
                  className={cn(
                    "block size-3 rotate-45",
                    p.kind === "guest" ? "border-2 border-guest-400 bg-black" : "bg-brand-500",
                  )}
                />
              )}
            </span>
          ))}

          <Readout className="absolute top-3 left-3 text-foreground">Berlin</Readout>
          <Readout className="absolute top-3 right-3">52.5200°N 13.4050°E</Readout>
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="h-1 w-12 border-x border-b border-muted-foreground" />
            <Readout>5 km</Readout>
          </div>
          <div className="absolute inset-0 opacity-60 wx-scanlines" />
        </div>
      </div>

      {/* Cluster list readout */}
      <div className="absolute right-0 bottom-0 z-10 w-[230px] sm:-right-6 sm:w-[250px]">
        <div className="relative border border-border bg-card shadow-[0_12px_40px_rgb(0_0_0/0.6)]">
          <CornerTicks size={8} className="text-foreground" />
          <div className="flex items-center justify-between bg-brand-500 px-3 py-1.5 font-display text-[0.65rem] font-black text-black uppercase italic">
            <span>Cluster 06</span>
            <span>Berlin</span>
          </div>
          <ul className="divide-y divide-border">
            {MOCK_LIST.map((a, i) => (
              <li key={a.handle} className="flex items-center gap-3 px-3 py-2">
                <Readout className="text-brand-500">0{i + 1}</Readout>
                <span className="min-w-0">
                  <span className="block truncate font-display text-[0.7rem] font-bold uppercase">{a.name}</span>
                  <span className="block truncate font-mono text-[0.6rem] text-brand-400">@{a.handle}</span>
                </span>
                {a.kind === "guest" && (
                  <span className="ml-auto border border-guest-400/60 px-1.5 py-0.5 font-mono text-[0.5rem] tracking-widest text-guest-300 uppercase">
                    Guest
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
