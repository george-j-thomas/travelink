import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  Globe,
  MapPin,
  PencilLine,
  Plane,
  RefreshCw,
  ScanText,
  Search,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InstagramIcon } from "@/components/icons/instagram";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type Tone = "brand" | "guest";

const STEPS: { icon: IconComponent; title: string; text: string }[] = [
  {
    icon: InstagramIcon,
    title: "Add your artists",
    text: "Import the accounts you follow on Instagram, or add artists one handle at a time.",
  },
  {
    icon: ScanText,
    title: "Travelink reads their bios",
    text: "In the background, it picks out each artist's home base, guest spots and guest spot dates. Keep browsing while it works.",
  },
  {
    icon: MapPin,
    title: "Find them on the map",
    text: "Every location gets a pin, so you can see who works in a city, or where an artist is headed next.",
  },
];

const FEATURES: { icon: IconComponent; title: string; text: string; tone?: Tone }[] = [
  {
    icon: Globe,
    title: "Home bases and guest spots",
    text: "Each kind of location has its own pin color. Show both, or filter the map down to one.",
  },
  {
    icon: CalendarDays,
    title: "Guest spot dates",
    text: "When a bio has dates, they show next to the guest spot, so you can catch an artist passing through.",
    tone: "guest",
  },
  {
    icon: Search,
    title: "Search by city",
    text: "Find artists by name, handle or city, or filter your list by location.",
  },
  {
    icon: PencilLine,
    title: "Fix it by hand",
    text: "Only public Business and Creator bios can be read. For anyone else, or a guest spot only announced in a post, add the location yourself.",
  },
  {
    icon: RefreshCw,
    title: "Refresh when plans change",
    text: "Bios are read once, when an artist is added. Refresh one artist, or all of them, when they move or announce new dates.",
  },
  {
    icon: ShieldCheck,
    title: "Your session stays in your tab",
    text: "Importing with your Instagram session keeps it in the open tab only, never on our server. Or upload a data export instead.",
  },
];

const EYEBROW = "text-xs font-medium uppercase tracking-[0.2em] text-brand-300";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { invite } = await searchParams;
  const inviteCode = typeof invite === "string" && invite ? invite : null;

  // Invite links land here, so keep them viewable while signed in
  const session = await getSession();
  if (session && !inviteCode) redirect("/map");

  const registerHref = inviteCode
    ? `/register?invite=${encodeURIComponent(inviteCode)}`
    : "/register";
  const hasInvite = inviteCode !== null;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-background">
      {/* Ambient glow — matches auth pages */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-brand-900/[0.07] blur-[100px]"
      />

      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
          <Wordmark />
          <nav className="flex items-center gap-2">
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
            <Link href={registerHref} className={buttonVariants({ size: "sm" })}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:py-24">
          <div>
            <p className={EYEBROW}>Tattoo artist tracker</p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Your tattoo artists, on one map
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-muted-foreground sm:text-lg">
              Artists move between studios, guest spots and conventions, and many list where
              they&apos;ll be in their Instagram bio. Travelink reads those bios for the artists
              you follow and puts everyone on one map.
            </p>
            <CallToAction registerHref={registerHref} className="mt-8" />
            <InviteNote hasInvite={hasInvite} className="mt-4" />
          </div>
          <MapPreview />
        </section>

        <section className="border-t border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionHeading eyebrow="How it works" title="From your following list to a map" />
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map(({ icon, title, text }, i) => (
                <li key={title}>
                  <Card className="h-full gap-0 border-border/50 p-5 shadow-2xl shadow-black/25">
                    <IconChip icon={icon} />
                    <h3 className="mt-5 flex items-center gap-2 text-base font-medium">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-semibold text-brand-300">
                        {i + 1}
                      </span>
                      {title}
                    </h3>
                    <p className="mt-2 text-pretty text-muted-foreground">{text}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border/50">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <SectionHeading eyebrow="What you get" title="Keep up with artists on the move" />
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon, title, text, tone }) => (
                <li key={title} className="flex gap-4">
                  <IconChip icon={icon} tone={tone} />
                  <div>
                    <h3 className="font-medium">{title}</h3>
                    <p className="mt-1 text-pretty text-sm text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
          <Card className="relative items-center gap-0 border-border/50 px-6 py-12 text-center shadow-2xl shadow-black/25 sm:py-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[28rem] max-w-full -translate-x-1/2 rounded-full bg-brand-600/15 blur-3xl"
            />
            <h2 className="relative text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
              Know where your next tattoo is
            </h2>
            <p className="relative mt-3 max-w-md text-pretty text-base text-muted-foreground">
              Already have an account? Sign in and pick up where you left off.
            </p>
            <CallToAction registerHref={registerHref} className="relative mt-8 justify-center" />
            <InviteNote hasInvite={hasInvite} className="relative mt-4 justify-center" />
          </Card>
        </section>
      </main>

      <footer className="border-t border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <Wordmark />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Travelink</p>
        </div>
      </footer>
    </div>
  );
}

function Wordmark() {
  return (
    <span className="select-none text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground">
      Travel
      <span className="text-brand-400">ink</span>
    </span>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
    </div>
  );
}

const CHIP_TONES: Record<Tone, { chip: string; icon: string }> = {
  brand: { chip: "bg-brand-500/10 ring-brand-500/20", icon: "text-brand-400/90" },
  guest: { chip: "bg-guest-500/10 ring-guest-500/20", icon: "text-guest-400/90" },
};

function IconChip({ icon: Icon, tone = "brand" }: { icon: IconComponent; tone?: Tone }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
        CHIP_TONES[tone].chip,
      )}
    >
      <Icon className={cn("size-5", CHIP_TONES[tone].icon)} strokeWidth={1.5} />
    </span>
  );
}

function CallToAction({ registerHref, className }: { registerHref: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Link href={registerHref} className={cn(buttonVariants({ size: "lg" }), "px-4")}>
        Get started
      </Link>
      <Link href="/login" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "px-4")}>
        Sign in
      </Link>
    </div>
  );
}

function InviteNote({ hasInvite, className }: { hasInvite: boolean; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}>
      <Ticket className="size-3.5 shrink-0 text-brand-400/90" />
      {hasInvite
        ? "Your invite is filled in on the next step."
        : "Travelink is invite-only. You'll need an invite link to sign up."}
    </p>
  );
}

/* Mock of the map page: filter bar, pins, clusters and a city popup. Positions are
   percentages, kept clear of the filter bar and the popup at both aspect ratios. */

const PREVIEW_FILTERS = [
  { label: "All", icon: Globe },
  { label: "Home bases", icon: MapPin },
  { label: "Guest spots", icon: Plane },
];

const PREVIEW_PINS: { x: number; y: number; guest?: boolean }[] = [
  { x: 10, y: 20 },
  { x: 22, y: 19, guest: true },
  { x: 52, y: 19 },
  { x: 66, y: 30 },
  { x: 90, y: 62, guest: true },
  { x: 78, y: 74 },
  { x: 14, y: 90 },
  { x: 64, y: 88, guest: true },
  { x: 88, y: 86 },
];

const PREVIEW_ARTISTS: { name: string; initials: string; handle: string; guest?: boolean }[] = [
  { name: "Mara Volk", initials: "MV", handle: "mara.volk.ink" },
  { name: "Juno Reyes", initials: "JR", handle: "junoreyes.tattoo", guest: true },
  { name: "Sasha K.", initials: "SK", handle: "sasha.k.flash" },
];

function MapPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[3/4] select-none overflow-hidden rounded-xl bg-card shadow-2xl shadow-black/25 ring-1 ring-foreground/10 sm:aspect-[4/3]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--card))]" />

      <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border/50 bg-background/80 p-1 shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150">
        {PREVIEW_FILTERS.map(({ label, icon: Icon }, i) => (
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

      {PREVIEW_PINS.map(({ x, y, guest }) => (
        <span
          key={`${x}-${y}`}
          className={cn(
            "absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/20",
            guest ? "bg-guest-500" : "bg-brand-400",
          )}
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      ))}

      <Cluster count={14} x={82} y={40} className="size-11 bg-brand-600" />
      <Cluster count={3} x={40} y={85} className="size-9 bg-brand-500" />

      {/* Sits just above the 3-artist cluster (top: 85%, 36px tall) */}
      <div className="absolute bottom-[calc(15%+26px)] left-[40%] w-60 -translate-x-1/2 overflow-hidden rounded-xl bg-background/95 shadow-2xl ring-1 ring-border/50 backdrop-blur-xl">
        <div className="flex items-start gap-3 border-b border-border/50 px-3.5 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-snug">Berlin, Germany</p>
            <p className="text-xs text-muted-foreground">{PREVIEW_ARTISTS.length} artists</p>
          </div>
          <X className="size-4 text-muted-foreground" />
        </div>
        <ul className="py-1">
          {PREVIEW_ARTISTS.map(({ name, initials, handle, guest }) => (
            <li key={handle} className="flex items-center gap-3 px-3.5 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-semibold text-brand-400">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium leading-snug">{name}</span>
                  {guest && <Plane className="size-3 shrink-0 text-guest-500" />}
                </div>
                <span className="block truncate text-xs text-muted-foreground">@{handle}</span>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Cluster({
  count,
  x,
  y,
  className,
}: {
  count: number;
  x: number;
  y: number;
  className: string;
}) {
  return (
    <span
      className={cn(
        "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-white ring-4 ring-brand-400/30",
        className,
      )}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      {count}
    </span>
  );
}
