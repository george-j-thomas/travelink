import type { ComponentType, CSSProperties, SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronsRight, MapPin, ScanText } from "lucide-react";

import { getSession } from "@/lib/auth";
import { InstagramIcon } from "@/components/icons/instagram";
import { cn } from "@/lib/utils";
import { BrandMark, RoutingLines } from "@/components/brand/marks";
import { MetalCanvas } from "@/components/metal/metal-canvas";
import { Screws, SpikeStar, ThornRow, type StarTone } from "@/components/metal/ornaments";

const STEPS: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  title: string;
  body: string;
  star: { points: number; seed: number; tone: StarTone };
}[] = [
  {
    icon: InstagramIcon,
    title: "Bring your follows",
    body: "Import the tattoo artists you already follow on Instagram, or add them one handle at a time.",
    star: { points: 9, seed: 4, tone: "gun" },
  },
  {
    icon: ScanText,
    title: "We read the bios",
    body: "Travelink reads each artist's bio and pulls out where they're based and where they're guesting next.",
    star: { points: 13, seed: 7, tone: "ice" },
  },
  {
    icon: MapPin,
    title: "See them on the map",
    body: "Every artist lands on one map. Plan your next piece around a trip, or catch them when they come to you.",
    star: { points: 7, seed: 2, tone: "mint" },
  },
];

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/artists");

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-background text-foreground">
      {/* ── Header: gunmetal bar with the moving sheen ──────────── */}
      <header className="metal-bar relative z-30">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-sheen opacity-60" />
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="Travelink home" className="flex items-center gap-1">
            <MetalCanvas
              scene="emblem"
              className="-my-4 -ml-3 size-16"
              fallback={<SpikeStar className="m-4 size-8" points={10} seed={5} />}
            />
            <BrandMark className="text-xl" />
          </Link>
          <LoginButton size="sm" />
        </div>
        <span aria-hidden="true" className="flow-line absolute inset-x-0 bottom-0 h-0.5" />
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative">
        <RoutingLines className="hidden text-gun-300/25 md:block" />

        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-4 px-5 pt-14 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:pt-20 lg:pb-28">
          <div className="relative z-10">
            <div className="animate-rise flex items-center gap-3">
              <SpikeStar className="size-7" points={8} seed={3} tone="mint" />
              <span className="font-wide text-[0.68rem] font-bold tracking-[0.3em] text-gun-200 uppercase">
                Tattoo artist tracker
              </span>
              <span aria-hidden="true" className="flow-line h-px w-16" />
            </div>

            <h1 className="animate-rise mt-7 font-display text-[2.7rem] leading-[0.98] lowercase [animation-delay:80ms] sm:text-7xl lg:text-[5.2rem]">
              <span className="text-chrome">your</span>
              <br />
              <span className="text-chrome">artists,</span>
              <br />
              <span className="text-chrome-brand">mapped</span>
            </h1>

            <p className="animate-rise mt-8 max-w-md text-base leading-relaxed text-muted-foreground [animation-delay:160ms] sm:text-lg">
              The artists you love move around: new studios, guest spots,
              conventions. Travelink reads their Instagram bios and puts them all
              on one map, so you always know where to find them.
            </p>

            <div className="animate-rise mt-10 flex flex-col items-start gap-6 [animation-delay:240ms] sm:flex-row sm:items-center">
              <LoginButton size="lg" />
              <InviteLink />
            </div>
          </div>

          <HeroStage />
        </div>
      </section>

      {/* ── Spike rail: thorns reach for the cursor ─────────────── */}
      <div aria-hidden="true" className="metal-bar relative z-10 h-20 sm:h-24">
        <span className="absolute inset-0 animate-sheen opacity-50 [animation-duration:9s]" />
        <span className="flow-line absolute inset-x-0 top-0 h-px" />
        <span className="flow-line absolute inset-x-0 bottom-0 h-px [animation-direction:reverse]" />
        <MetalCanvas
          scene="rail"
          layout="band"
          className="absolute inset-x-0 -top-24 -bottom-24"
          fallback={<ThornRow className="absolute inset-x-0 top-1/2" />}
        />
      </div>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-28 pb-24 sm:px-8 lg:pt-32">
        <div className="flex items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="flow-line h-px w-12" />
              <span className="font-wide text-[0.68rem] font-bold tracking-[0.3em] text-gun-200 uppercase">
                How it works
              </span>
            </div>
            <h2 className="mt-4 font-display text-[1.7rem] leading-[1.02] lowercase text-chrome sm:text-5xl">
              three steps
              <br />
              to your map
            </h2>
          </div>
          <MetalCanvas
            scene="shards"
            layout="burst"
            className="-my-16 hidden size-72 shrink-0 md:block"
            fallback={<SpikeStar className="m-16 size-40" points={16} seed={12} tone="ice" />}
          />
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="metal-surface flow-edge relative rounded-2xl p-7"
              style={{ "--edge-dur": `${6 + i * 1.5}s` } as CSSProperties}
            >
              <Screws />
              <div className="flex items-start justify-between">
                <span className="font-display text-6xl leading-none text-chrome">0{i + 1}</span>
                <SpikeStar className="-mt-3 -mr-3 size-16" {...step.star} />
              </div>
              <div className="mt-8 flex items-center gap-2.5">
                <step.icon className="size-4 text-brand-300" />
                <h3 className="font-wide text-sm font-bold tracking-[0.08em] uppercase">{step.title}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-5 pt-8 pb-28 sm:px-8">
        <div className="metal-surface flow-edge relative rounded-3xl px-7 py-12 [--edge-dur:9s] [--edge-w:1.5px] sm:px-12 lg:py-16 lg:pr-72">
          <Screws inset={14} size={9} />
          <SpikeStar className="absolute -top-7 -left-7 size-16" points={11} seed={21} tone="chrome" />
          <h2 className="font-display text-[1.9rem] leading-[1.02] lowercase sm:text-5xl">
            <span className="text-chrome">know where your</span>
            <br />
            <span className="text-chrome">next</span> <span className="text-chrome-brand">tattoo</span>{" "}
            <span className="text-chrome">is.</span>
          </h2>
          <div className="mt-8 grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <p className="max-w-sm text-muted-foreground">
              Already have an account? Log in and pick up where you left off.
              Travelink is invite only, so ask a friend who&apos;s in.
            </p>
            <div className="flex flex-col items-start gap-5">
              <LoginButton size="lg" />
              <InviteLink />
            </div>
          </div>
          <MetalCanvas
            scene="spheres"
            className="absolute -top-28 right-4 -bottom-28 hidden w-64 lg:block"
            fallback={<SpikeStar className="absolute top-1/2 left-1/2 size-40 -translate-1/2" points={14} seed={30} />}
          />
        </div>
      </section>

      <footer className="metal-bar relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 animate-sheen opacity-50 [animation-delay:-3s]" />
        <span aria-hidden="true" className="flow-line absolute inset-x-0 top-0 h-px" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-7 sm:flex-row sm:px-8">
          <BrandMark className="text-base" />
          <div aria-hidden="true" className="flex items-center gap-3">
            <SpikeStar className="size-5" points={7} seed={41} tone="mint" back={false} />
            <SpikeStar className="size-7" points={10} seed={42} />
            <SpikeStar className="size-5" points={7} seed={43} tone="ice" back={false} />
          </div>
          <span className="font-wide text-[0.65rem] tracking-[0.22em] text-muted-foreground uppercase">© 2026 Travelink</span>
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
        "btn-chrome group inline-flex items-center rounded-full font-wide font-bold uppercase",
        "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ice-400",
        size === "lg" ? "h-13 gap-3 px-8 text-sm tracking-[0.12em]" : "h-9 gap-2 px-5 text-[0.68rem] tracking-[0.12em]",
      )}
    >
      Log in
      <ChevronsRight
        className={cn("transition-transform duration-200 group-hover:translate-x-1", size === "lg" ? "size-4" : "size-3.5")}
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
      <span className="font-semibold text-foreground underline decoration-ice-400 decoration-2 underline-offset-[6px] group-hover:text-ice-200">
        Create your account
      </span>
    </Link>
  );
}

const MOCK_LIST = [
  { name: "Mara Volk", handle: "mara.ink", kind: "home" },
  { name: "Juno Reyes", handle: "junotattoo", kind: "guest" },
  { name: "Sasha K.", handle: "sashaflash", kind: "home" },
] as const;

/** Hero centrepiece: the chrome urchin inside a shimmering chrome ring,
 *  with a small artist plate showing what the map gives you. */
function HeroStage() {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[520px]">
      <div className="absolute inset-[14%] animate-pulse-glow rounded-full bg-[radial-gradient(circle,rgb(79_147_245/0.24),rgb(25_183_146/0.12)_45%,transparent_70%)] blur-2xl" />
      <div className="chrome-ring absolute inset-[3%] [--ring-w:3px]" />
      <div className="chrome-ring absolute inset-[9%] opacity-40 [--ring-w:1px] [animation-direction:reverse]" />
      <MetalCanvas
        scene="urchin"
        className="absolute -inset-[24%]"
        fallback={<SpikeStar className="absolute inset-[30%] size-[40%]" points={18} seed={8} />}
      />
      {/* Satellites: CSS spike stars that shimmer and tilt with the cursor */}
      <span className="animate-float absolute top-[2%] left-[6%] [--float-dur:7s]">
        <SpikeStar className="size-12" points={9} seed={14} tone="ice" />
      </span>
      <span className="animate-float absolute top-[14%] -right-[4%] [--float-dur:9s] [animation-delay:-3s]">
        <SpikeStar className="size-8" points={7} seed={15} tone="chrome" back={false} />
      </span>
      <span className="animate-float absolute right-[10%] bottom-[4%] [--float-dur:8s] [animation-delay:-5s]">
        <SpikeStar className="size-14" points={13} seed={16} tone="gun" />
      </span>

      <div className="metal-surface flow-edge absolute bottom-0 -left-1 z-10 w-[236px] rounded-xl [--edge-dur:5s] sm:-left-8">
        <Screws inset={6} size={5} />
        <div className="flex items-baseline justify-between gap-3 border-b border-white/5 px-4 pt-3.5 pb-3">
          <span className="font-display text-sm whitespace-nowrap text-gun-50">Berlin, Germany</span>
          <span className="font-wide text-[0.58rem] tracking-[0.16em] whitespace-nowrap text-muted-foreground uppercase">
            6 artists
          </span>
        </div>
        <ul className="divide-y divide-white/5 pb-1">
          {MOCK_LIST.map((a) => (
            <li key={a.handle} className="flex items-center gap-2.5 px-4 py-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-gun-950",
                  a.kind === "guest"
                    ? "bg-[radial-gradient(circle_at_35%_30%,#e6f1ff,#7fa9e6_45%,#1d3352_90%)]"
                    : "bg-[radial-gradient(circle_at_35%_30%,#f4f7f8,#9aa7af_45%,#20272c_90%)]",
                )}
              >
                {a.name[0]}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">{a.name}</span>
                <span className="block truncate text-[0.65rem] text-brand-300">@{a.handle}</span>
              </span>
              {a.kind === "guest" && (
                <span className="ml-auto rounded-full border border-guest-500/40 bg-guest-500/10 px-1.5 py-0.5 font-wide text-[0.5rem] tracking-widest text-guest-300 uppercase">
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
