import Link from "next/link";
import { redirect } from "next/navigation";
import { LocateFixed, Lock, MapPin, Plane, ScanText } from "lucide-react";

import { getSession } from "@/lib/auth";
import { InstagramIcon } from "@/components/icons/instagram";
import { cn } from "@/lib/utils";
import {
  BrandMark,
  Chevrons,
  Glyph,
  type GlyphKind,
  Plus,
  Readout,
  RoutingLines,
  Ruler,
  SpeedLines,
  Tag,
  Warn,
} from "@/components/brand/marks";

const MARQUEE = [
  "home bases",
  "guest spots",
  "berlin",
  "conventions",
  "tokyo",
  "walk-ins",
  "lisbon",
  "flash days",
  "mexico city",
  "books open",
];

const BAND_GLYPHS: GlyphKind[] = ["slash", "plus", "arrow", "dots", "half", "split", "plus", "slash"];

const STEPS = [
  {
    icon: InstagramIcon,
    glyph: "arrow" as GlyphKind,
    title: "Bring your follows",
    body: "Import the tattoo artists you already follow on Instagram, or add them one handle at a time.",
  },
  {
    icon: ScanText,
    glyph: "dots" as GlyphKind,
    title: "We read the bios",
    body: "Travelink reads each artist's bio and pulls out where they're based and where they're guesting next.",
  },
  {
    icon: MapPin,
    glyph: "half" as GlyphKind,
    title: "See them on the map",
    body: "Every artist lands on one map. Plan your next piece around a trip, or catch them when they come to you.",
  },
];

const FEATURES = [
  {
    code: "W-01",
    icon: Plane,
    title: "Guest spot radar",
    body: "Guest spots show up in graphite with their dates, so you can see who's passing through your city.",
  },
  {
    code: "W-02",
    icon: LocateFixed,
    title: "Near me",
    body: "One tap centres the map on you and shows which of your artists are within reach.",
  },
  {
    code: "W-03",
    icon: Lock,
    title: "Invite only",
    body: "Your list is yours. Travelink is a small, private crew. You join with an invite from a friend.",
  },
];

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/artists");

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="relative z-20 border-b border-foreground/15">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="Travelink home">
            <BrandMark className="text-xl" />
          </Link>
          <div className="hidden items-end gap-6 md:flex">
            <Ruler />
            <Tag square="bg-foreground">File under: tattoo artists</Tag>
          </div>
          <LoginButton size="sm" />
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative">
        <RoutingLines className="hidden text-foreground/30 lg:block" />
        <Plus className="absolute top-10 right-[8%] hidden size-4 text-foreground/50 sm:block" />
        <Plus className="absolute bottom-16 left-[46%] hidden size-4 text-foreground/50 lg:block" />

        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-16 px-5 pt-14 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-20 lg:pb-28">
          <div>
            <div className="animate-dr-rise flex flex-wrap items-center gap-3">
              <Tag className="bg-background">
                <span className="font-display text-[0.7rem] tracking-[0.12em]">トラベリンク</span>
              </Tag>
              <Readout>{"//:001"}</Readout>
              <Warn className="h-3.5 w-4 text-brand-500" />
            </div>

            <h1 className="animate-dr-rise mt-7 font-display text-[3.1rem] leading-[0.92] tracking-tight lowercase [animation-delay:80ms] sm:text-7xl lg:text-[5.4rem]">
              your
              <br />
              artists,
              <br />
              <span className="text-brand-500">mapped″</span>
            </h1>

            <p className="animate-dr-rise mt-8 max-w-md text-base leading-relaxed text-muted-foreground [animation-delay:160ms] sm:text-lg">
              The artists you love move around: new studios, guest spots,
              conventions. Travelink reads their Instagram bios and puts them all
              on one map, so you always know where to find them.
            </p>

            <div className="animate-dr-rise mt-10 flex flex-col items-start gap-6 [animation-delay:240ms] sm:flex-row sm:items-center">
              <LoginButton size="lg" />
              <InviteLink />
            </div>

            <ul className="animate-dr-rise mt-12 flex flex-wrap gap-x-6 gap-y-3 [animation-delay:320ms]">
              {[
                ["00.01", "Instagram follows"],
                ["00.02", "Bio → location"],
                ["00.03", "One map"],
              ].map(([code, label]) => (
                <li key={code} className="flex items-center gap-2">
                  <span className="size-2 bg-foreground" />
                  <Readout className="text-foreground">{code}</Readout>
                  <Readout>{label}</Readout>
                </li>
              ))}
            </ul>
          </div>

          <HeroArt />
        </div>
      </section>

      {/* ── Speed-line band ─────────────────────────────────────── */}
      <div aria-hidden="true" className="relative overflow-hidden border-y border-foreground/15 bg-paper-dark py-6">
        <SpeedLines seed={7} className="absolute inset-0 size-full text-guest-600/70" />
        <div className="relative flex w-max animate-dr-marquee">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {MARQUEE.map((word, i) => (
                <span key={word} className="flex items-center gap-4 pr-4">
                  <span className="bg-background px-3 py-1 font-display text-2xl whitespace-nowrap lowercase sm:text-3xl">
                    {word}
                  </span>
                  <Glyph kind={BAND_GLYPHS[i % BAND_GLYPHS.length]} className="size-7 rounded-full bg-background text-foreground" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-28">
        <SectionHeading code="//:002" title="three steps to your map" />

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative bg-card p-7 dr-notch [--notch:22px]">
              <div className="flex items-start justify-between">
                <span className="font-display text-5xl leading-none">0{i + 1}</span>
                <Glyph kind={step.glyph} className="size-6 text-foreground/70" />
              </div>
              <div className="mt-8 flex items-center gap-2.5">
                <step.icon className="size-4 text-brand-500" />
                <h3 className="font-wide text-sm font-bold uppercase tracking-[0.06em]">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              <Readout className="mt-6 block">Step 0{i + 1} / 03</Readout>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-foreground/15 bg-paper-dark">
        <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.5fr] lg:py-28">
          <div>
            <SectionHeading code="//:003" title="never miss a guest spot" />
            <p className="mt-6 max-w-sm text-muted-foreground">
              Built for people who plan trips around tattoos, and for catching
              the artists who come to you.
            </p>
          </div>

          <ul className="border-t border-foreground/25">
            {FEATURES.map((f) => (
              <li key={f.title} className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1 border-b border-foreground/25 py-6 sm:grid-cols-[4.5rem_auto_1fr]">
                <Readout className="hidden pt-1 text-foreground sm:block">{f.code}</Readout>
                <span className="flex size-9 items-center justify-center rounded-full border border-foreground/60">
                  <f.icon className="size-4" />
                </span>
                <div>
                  <h3 className="font-wide text-sm font-bold uppercase tracking-[0.06em]">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-24 pb-16 sm:px-8 lg:pt-28">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Readout>{"//:004"}</Readout>
            <h2 className="mt-5 font-display text-[2.2rem] leading-[0.95] tracking-tight lowercase sm:text-6xl">
              know where your
              <br />
              next <span className="text-brand-500">tattoo</span> is.
            </h2>
          </div>
          <div>
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

        {/* Wipeout-style vermilion tab */}
        <div aria-hidden="true" className="mt-20 flex items-center gap-5 overflow-hidden rounded-xl bg-brand-500 px-6 py-5 text-white sm:px-8">
          <span className="font-display text-2xl whitespace-nowrap sm:text-4xl">旅するインク</span>
          <span className="hidden font-mono text-[0.65rem] tracking-[0.2em] whitespace-nowrap uppercase sm:block">
            {"(travel>ink>>)"}
          </span>
          <span className="ml-auto flex gap-2">
            {(["slash", "plus", "arrow"] as const).map((k) => (
              <Glyph key={k} kind={k} className="size-6" />
            ))}
          </span>
        </div>
      </section>

      <footer className="border-t border-foreground/15">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <BrandMark className="text-base" />
          <Readout className="text-center">Built for people who travel for ink</Readout>
          <Readout>{"//:009"}</Readout>
        </div>
      </footer>
    </div>
  );
}

/* ═══ Pieces ═════════════════════════════════════════════════════════ */

function LoginButton({ size }: { size: "sm" | "lg" }) {
  return (
    <Link
      href="/login"
      className={cn(
        "group inline-flex items-center rounded-[4px] bg-brand-500 font-wide font-bold uppercase text-white transition-colors duration-150",
        "hover:bg-foreground active:bg-brand-600",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground",
        size === "lg" ? "h-13 gap-4 px-7 text-sm tracking-[0.1em]" : "h-9 gap-2.5 px-4 text-[0.68rem] tracking-[0.1em]",
      )}
    >
      Log in
      <Chevrons
        count={size === "lg" ? 3 : 2}
        className={cn("w-auto transition-transform duration-200 group-hover:translate-x-1", size === "lg" ? "h-3" : "h-2.5")}
      />
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
      <span className="font-semibold text-foreground underline decoration-brand-500 decoration-2 underline-offset-[6px] group-hover:text-brand-600">
        Create your account
      </span>
    </Link>
  );
}

function SectionHeading({ code, title }: { code: string; title: string }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="size-2 bg-brand-500" />
        <Readout className="text-foreground">{code}</Readout>
        <span className="h-px w-16 bg-foreground/30" />
      </div>
      <h2 className="mt-4 font-display text-3xl leading-none tracking-tight lowercase sm:text-5xl">{title}</h2>
    </div>
  );
}

const MOCK_PINS = [
  { x: "20%", y: "34%", kind: "home" },
  { x: "52%", y: "42%", kind: "cluster" },
  { x: "64%", y: "68%", kind: "guest" },
  { x: "80%", y: "28%", kind: "home" },
  { x: "30%", y: "72%", kind: "guest" },
  { x: "86%", y: "70%", kind: "home" },
] as const;

const MOCK_LIST = [
  { name: "Mara Volk", handle: "mara.ink", kind: "home" },
  { name: "Juno Reyes", handle: "junotattoo", kind: "guest" },
  { name: "Sasha K.", handle: "sashaflash", kind: "home" },
] as const;

/** Decorative product mock: a map panel plus the cluster list popup. */
function HeroArt() {
  return (
    <div aria-hidden="true" className="animate-dr-rise relative mx-auto w-full max-w-[480px] pb-16 [animation-delay:300ms]">
      <div className="mb-3 flex items-center justify-between">
        <Chevrons count={3} className="h-3 w-auto text-brand-500" />
        <Readout>Fig. 01 — map view</Readout>
      </div>

      {/* Map panel */}
      <div className="overflow-hidden rounded-lg border border-foreground/20 bg-card">
        <div className="flex items-center justify-between border-b border-foreground/15 px-3 py-2">
          <span className="flex items-center gap-2">
            <span className="rounded-[3px] bg-foreground px-1.5 py-1 font-mono text-[0.55rem] leading-none tracking-[0.18em] text-background uppercase">
              Berlin
            </span>
            <Readout>52.52°N 13.40°E</Readout>
          </span>
          <span className="size-2 bg-brand-500 animate-dr-blink" />
        </div>
        <div className="relative aspect-[4/3] bg-paper-dark">
          <div className="absolute inset-0 text-foreground/[0.06] dr-grid [--grid:24px]" />
          <svg viewBox="0 0 400 300" className="absolute inset-0 size-full" fill="none">
            <path d="M-10 220C50 200 80 240 150 214s120-100 190-80 80 36 80 36" stroke="#c9cccb" strokeWidth="22" />
            <g stroke="#b6bab9" strokeWidth="1.5">
              <path d="M0 90h400M0 168h400M90 0v300M210 0v300M320 0v300" />
              <path d="M0 10l290 290M140 0l260 260" opacity=".6" />
            </g>
          </svg>

          {MOCK_PINS.map((p, i) => (
            <span key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
              {p.kind === "cluster" ? (
                <span className="flex size-11 items-center justify-center rounded-full bg-brand-500 font-display text-base text-white ring-[6px] ring-brand-500/25">
                  6
                </span>
              ) : (
                <span
                  className={cn(
                    "block size-3.5 rounded-full ring-2 ring-white",
                    p.kind === "guest" ? "bg-guest-600" : "bg-brand-500",
                  )}
                />
              )}
            </span>
          ))}

          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span className="h-1.5 w-12 border-x border-b border-foreground/60" />
            <Readout>5 km</Readout>
          </div>
        </div>
      </div>

      {/* Cluster list popup */}
      <div className="absolute right-0 bottom-0 z-10 w-[264px] overflow-hidden rounded-md border border-foreground/20 bg-card shadow-[0_22px_40px_-20px_rgb(0_0_0/0.45)] sm:-right-6">
        <div className="flex items-baseline justify-between gap-3 border-b border-foreground/15 px-3 py-2.5">
          <span className="font-display text-sm whitespace-nowrap">Berlin, Germany</span>
          <Readout className="whitespace-nowrap">6 artists</Readout>
        </div>
        <ul className="divide-y divide-foreground/10">
          {MOCK_LIST.map((a) => (
            <li key={a.handle} className="flex items-center gap-2.5 px-3 py-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold",
                  a.kind === "guest" ? "bg-guest-600 text-white" : "bg-brand-100 text-brand-700",
                )}
              >
                {a.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{a.name}</span>
                <span className="block truncate text-[0.65rem] text-brand-600">@{a.handle}</span>
              </span>
              {a.kind === "guest" && (
                <span className="ml-auto rounded-[3px] border border-guest-600/50 px-1.5 py-0.5 font-mono text-[0.5rem] tracking-widest text-guest-600 uppercase">
                  Guest
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
