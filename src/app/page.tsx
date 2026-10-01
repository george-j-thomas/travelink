import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, ScanText } from "lucide-react";

import { getSession } from "@/lib/auth";
import { InstagramIcon } from "@/components/icons/instagram";
import { cn } from "@/lib/utils";
import { ChromeStage } from "@/components/brand/chrome-stage";
import {
  BrandMark,
  Chevrons,
  Glyph,
  type GlyphKind,
  Halftone,
  Plus,
  Readout,
  RoutingLines,
  Ruler,
  SpeedLines,
  Stamp,
  Tag,
  Warn,
  WaveDisc,
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

const CITIES = [
  { code: "BER", name: "berlin", lat: "52.52°N", lng: "13.40°E" },
  { code: "TYO", name: "tokyo", lat: "35.68°N", lng: "139.69°E" },
  { code: "LIS", name: "lisbon", lat: "38.72°N", lng: "9.14°W" },
  { code: "CDMX", name: "mexico city", lat: "19.43°N", lng: "99.13°W" },
  { code: "SEL", name: "seoul", lat: "37.57°N", lng: "126.98°E" },
  { code: "LAX", name: "los angeles", lat: "34.05°N", lng: "118.24°W" },
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
            <Tag square="bg-foreground">52.52°N 13.40°E</Tag>
            <Halftone cols={14} rows={3} className="hidden h-3 w-auto text-foreground/70 lg:block" />
          </div>
          <LoginButton size="sm" />
        </div>
      </header>

      {/* ── Coordinate ticker ───────────────────────────────────── */}
      <div aria-hidden="true" className="glass overflow-hidden border-y border-border py-1.5 text-foreground">
        <div className="flex w-max animate-dr-marquee-reverse">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center">
              {CITIES.map((c) => (
                <span key={c.code} className="flex items-center gap-3 pr-6 font-mono text-[0.6rem] tracking-[0.2em] whitespace-nowrap uppercase">
                  <span className="size-1.5 bg-brand-500" />
                  <span className="font-bold">{c.code}</span>
                  <span className="text-muted-foreground">{c.lat} {c.lng}</span>
                  <span className="text-brand-500/50">{"///"}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative">
        <RoutingLines className="hidden text-foreground/30 lg:block" />
        <span aria-hidden="true" className="dr-outline pointer-events-none absolute right-[1%] bottom-[-2%] hidden text-[12rem] leading-none select-none [--outline-c:rgb(25_183_146/0.14)] lg:block">
          001
        </span>
        <Halftone className="absolute top-5 right-[3%] h-8 w-auto text-foreground/15 sm:h-14" />
        <Plus className="absolute top-10 right-[8%] hidden size-4 text-foreground/50 sm:block" />
        <Plus className="absolute bottom-16 left-[46%] hidden size-4 text-foreground/50 lg:block" />
        <Plus className="absolute top-[42%] left-[3%] hidden size-3 text-foreground/50 lg:block" />
        <Plus className="absolute top-[18%] left-[48%] hidden size-3 text-brand-500 lg:block" />
        <Chevrons count={5} className="absolute bottom-10 left-[3%] hidden h-2.5 w-auto text-foreground/40 lg:block" />
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-3 hidden -translate-y-1/2 font-mono text-[0.55rem] tracking-[0.3em] text-muted-foreground uppercase [writing-mode:vertical-rl] xl:block"
        >
          TRV/INK — 001 — 52.52N 13.40E — 35.68N 139.69E
        </span>

        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-16 px-5 pt-14 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-20 lg:pb-28">
          <div>
            <div className="animate-dr-rise flex flex-wrap items-center gap-3">
              <Tag className="bg-background">
                <span className="font-jp text-[0.7rem] tracking-[0.12em]">トラベリンク</span>
              </Tag>
              <Readout>{"//:001"}</Readout>
              <Warn className="h-3.5 w-4 text-brand-500" />
              <span className="h-px w-10 bg-foreground/40" />
              <Readout className="text-foreground">Rev. 02</Readout>
            </div>

            <h1 className="animate-dr-rise mt-7 font-display text-[2.7rem] leading-[0.98] lowercase [animation-delay:80ms] sm:text-7xl lg:text-[5.2rem]">
              <span className="text-chrome">your</span>
              <br />
              <span className="text-chrome">artists,</span>
              <br />
              <span className="text-chrome-brand">mapped″</span>
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

          <HeroStage />
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
                  <span className="bg-background px-3 py-1 font-display text-2xl whitespace-nowrap lowercase text-chrome sm:text-3xl">
                    {word}
                  </span>
                  <Glyph kind={BAND_GLYPHS[i % BAND_GLYPHS.length]} className="size-7 rounded-full bg-background text-brand-400" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 lg:py-28">
        <Plus className="absolute top-10 right-5 size-4 text-foreground/50 sm:right-8" />
        <div className="flex flex-wrap items-end justify-between gap-8">
          <SectionHeading code="//:002" title="three steps to your map" />
          <div className="hidden flex-col items-end gap-3 md:flex">
            <Halftone cols={18} rows={4} className="h-6 w-auto text-foreground/30" />
            <Ruler labels={["01", "02", "03", "G.0"]} />
          </div>
        </div>

        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="metal-surface relative p-7 dr-notch [--notch:22px]">
              <div className="flex items-start justify-between">
                <span className="font-display text-5xl leading-none text-chrome">0{i + 1}</span>
                <Glyph kind={step.glyph} className="size-6 text-brand-400/80" />
              </div>
              <div className="mt-8 flex items-center gap-2.5">
                <step.icon className="size-4 text-brand-400" />
                <h3 className="font-wide text-sm font-bold uppercase tracking-[0.06em]">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              <div className="mt-6 flex items-center gap-3">
                <Readout>Step 0{i + 1} / 03</Readout>
                <span className="h-px flex-1 bg-foreground/20" />
                <Chevrons count={i + 1} className="h-2 w-auto text-brand-500" />
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── City board ──────────────────────────────────────────── */}
      <section aria-hidden="true" className="relative overflow-hidden border-y border-foreground/15 bg-paper-dark">
        <RoutingLines layout="band" className="hidden text-foreground/25 md:block" />
        <Halftone className="absolute -bottom-2 left-0 h-24 w-auto text-foreground/10" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:py-24">
          <div className="relative mx-auto w-full max-w-[340px]">
            <div className="mb-3 flex items-center justify-between">
              <Readout className="text-foreground">{"//:003"}</Readout>
              <Readout>Fig. 02</Readout>
            </div>
            <WaveDisc className="w-full">
              <span className="font-jp text-[2.1rem] leading-none text-chrome-brand sm:text-[2.5rem]">トラベリンク</span>
            </WaveDisc>
            <Stamp id="stamp-city" text="Travelink • artist map • rev 02 • " className="absolute -right-4 -bottom-6 size-24 bg-paper-dark text-foreground sm:-right-10">
              <Glyph kind="plus" className="size-6 text-brand-500" />
            </Stamp>
            <Plus className="absolute -top-8 -left-6 size-4 text-foreground/60" />
          </div>

          <ol className="border-t-2 border-foreground">
            {CITIES.map((c, i) => (
              <li key={c.code} className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-foreground/25 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-5">
                <Readout className="text-foreground">{String(i + 1).padStart(2, "0")}</Readout>
                <span className={cn("truncate font-display text-2xl leading-none lowercase sm:text-4xl", i === 0 && "text-brand-500")}>
                  {c.name}
                </span>
                <span className="flex flex-col items-end gap-1 text-right">
                  <Readout className="text-foreground">{c.code}</Readout>
                  <Readout className="hidden sm:block">
                    {c.lat} {c.lng}
                  </Readout>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-24 pb-16 sm:px-8 lg:pt-28">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <Readout>{"//:004"}</Readout>
            <h2 className="mt-5 font-display text-[1.9rem] leading-[1.02] lowercase text-chrome sm:text-5xl">
              know where your
              <br />
              next <span className="text-chrome-brand">tattoo</span> is.
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

        <div aria-hidden="true" className="mt-20 flex items-end justify-between gap-4 overflow-hidden">
          <span className="dr-outline text-[13vw] leading-[0.8] lowercase [--outline:1.5px] lg:text-[9.5rem]">travelink</span>
          <span className="hidden flex-col items-end gap-2 pb-2 md:flex">
            <Chevrons count={4} className="h-3 w-auto text-brand-500" />
            <Readout>{"//:005"}</Readout>
          </span>
        </div>

        {/* Metalheart chrome tab */}
        <div aria-hidden="true" className="metal-surface relative mt-4 flex items-center gap-5 overflow-hidden rounded-xl px-6 py-5 sm:px-8">
          <span className="pointer-events-none absolute inset-0 animate-sheen opacity-60" />
          <span className="relative font-jp text-2xl whitespace-nowrap text-chrome-brand sm:text-4xl">旅するインク</span>
          <span className="relative hidden font-mono text-[0.65rem] tracking-[0.2em] whitespace-nowrap text-foreground/60 uppercase sm:block">
            {"(travel>ink>>)"}
          </span>
          <span className="relative ml-auto flex gap-2 text-brand-300">
            {(["slash", "plus", "arrow"] as const).map((k) => (
              <Glyph key={k} kind={k} className="size-6" />
            ))}
          </span>
        </div>
      </section>

      <footer className="border-t border-foreground/15">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <BrandMark className="text-base" />
          <Readout className="text-center">© 2026 Travelink</Readout>
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
        "group inline-flex items-center rounded-[4px] bg-brand-500 font-wide font-bold uppercase text-[#04110d] transition-colors duration-150",
        "hover:bg-brand-400 active:bg-brand-600",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400",
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
      <h2 className="mt-4 font-display text-[1.7rem] leading-[1.02] lowercase text-chrome sm:text-5xl">{title}</h2>
    </div>
  );
}

const MOCK_LIST = [
  { name: "Mara Volk", handle: "mara.ink", kind: "home" },
  { name: "Juno Reyes", handle: "junotattoo", kind: "guest" },
  { name: "Sasha K.", handle: "sashaflash", kind: "home" },
] as const;

/** Hero centerpiece: an interactive chrome artifact in a bezelled stage,
 *  overlaid with a floating cluster-list readout. */
function HeroStage() {
  return (
    <div
      aria-hidden="true"
      className="animate-dr-rise relative mx-auto w-full max-w-[480px] pb-16 [animation-delay:300ms]"
    >
      <div className="mb-3 flex items-center justify-between">
        <Chevrons count={3} className="h-3 w-auto text-brand-400" />
        <Readout>Fig. 01 — rev 03 / chrome</Readout>
      </div>

      {/* 3D stage */}
      <div className="metal-surface relative aspect-square overflow-hidden rounded-xl dr-notch [--notch:26px]">
        <div className="absolute inset-0 text-brand-500/[0.07] dr-grid [--grid:26px]" />
        <div className="pointer-events-none absolute -inset-10 animate-pulse-glow bg-[radial-gradient(circle_at_50%_55%,rgb(25_183_146/0.35),transparent_62%)]" />
        <ChromeStage />

        {/* Corner readouts etched on the glass */}
        <span className="absolute left-3 top-3 font-mono text-[0.55rem] tracking-[0.28em] text-foreground/60 uppercase">
          TRV//INK
        </span>
        <span className="absolute right-3 top-3 size-2 bg-brand-500 animate-dr-blink" />
        <span className="absolute bottom-3 left-3 font-mono text-[0.55rem] tracking-[0.24em] text-foreground/50 uppercase">
          chrome_core.obj
        </span>
        <Chevrons count={3} className="absolute bottom-3 right-3 h-2.5 w-auto text-ice-400" />
      </div>

      {/* Cluster list popup — now a dark glass readout */}
      <div className="glass metal-bezel absolute -right-2 bottom-2 z-10 w-[264px] overflow-hidden rounded-md sm:-right-6">
        <div className="flex items-baseline justify-between gap-3 border-b border-foreground/10 px-3 py-2.5">
          <span className="font-display text-sm whitespace-nowrap text-foreground">Berlin, Germany</span>
          <Readout className="whitespace-nowrap">6 artists</Readout>
        </div>
        <ul className="divide-y divide-foreground/10">
          {MOCK_LIST.map((a) => (
            <li key={a.handle} className="flex items-center gap-2.5 px-3 py-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold",
                  a.kind === "guest"
                    ? "bg-guest-600 text-ice-200"
                    : "bg-brand-500/15 text-brand-300",
                )}
              >
                {a.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">{a.name}</span>
                <span className="block truncate text-[0.65rem] text-brand-400">@{a.handle}</span>
              </span>
              {a.kind === "guest" && (
                <span className="ml-auto rounded-[3px] border border-ice-500/40 px-1.5 py-0.5 font-mono text-[0.5rem] tracking-widest text-ice-300 uppercase">
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
