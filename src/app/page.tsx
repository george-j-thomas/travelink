import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Globe,
  MapPin,
  PencilLine,
  RefreshCw,
  ScanText,
  Search,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InstagramIcon } from "@/components/icons/instagram";
import { LandingMapPreview } from "@/components/landing-map-preview";

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
    title: "travel-ink reads their bios",
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
          <Wordmark href="#top" />
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
            <p className={cn(EYEBROW, "motion-safe:animate-rise")}>Tattoo artist tracker</p>
            <h1
              className="mt-4 text-balance text-4xl font-semibold tracking-tight motion-safe:animate-rise sm:text-5xl"
              style={{ animationDelay: "80ms" }}
            >
              Your tattoo artists, on one map
            </h1>
            <p
              className="mt-5 max-w-xl text-pretty text-muted-foreground motion-safe:animate-rise sm:text-lg"
              style={{ animationDelay: "160ms" }}
            >
              Artists move between studios, guest spots and conventions, and many list where
              they&apos;ll be in their Instagram bio. travel-ink reads those bios for the artists
              you follow and puts everyone on one map.
            </p>
            <div className="motion-safe:animate-rise" style={{ animationDelay: "240ms" }}>
              <CallToAction registerHref={registerHref} className="mt-8" />
              <InviteNote hasInvite={hasInvite} className="mt-4" />
            </div>
          </div>
          <LandingMapPreview />
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
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} travel-ink</p>
        </div>
      </footer>
    </div>
  );
}

const WORDMARK = "select-none text-sm font-medium uppercase tracking-[0.25em] text-muted-foreground";

/* As a link, hovering lights up "travel-", like the app navbar's wordmark */
function Wordmark({ href }: { href?: string }) {
  const text = (
    <>
      travel-
      <span className="text-brand-400">ink</span>
    </>
  );
  return href ? (
    <a href={href} className={cn(WORDMARK, "transition-colors hover:text-foreground")}>
      {text}
    </a>
  ) : (
    <span className={WORDMARK}>{text}</span>
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
        : "travel-ink is invite-only. You'll need an invite link to sign up."}
    </p>
  );
}
