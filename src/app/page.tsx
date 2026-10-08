import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, ScanText } from "lucide-react";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons/instagram";

const STEPS: { icon: ComponentType<SVGProps<SVGSVGElement>>; text: string }[] = [
  { icon: InstagramIcon, text: "Import the artists you follow on Instagram" },
  { icon: ScanText, text: "We read their bios to find where they work" },
  { icon: MapPin, text: "See their home bases and guest spots on the map" },
];

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

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-16">
      {/* Ambient glow — matches auth pages */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-brand-900/[0.07] blur-[100px]"
      />

      <main className="relative flex w-full max-w-md flex-col items-center text-center">
        <span className="select-none text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Travel
          <span className="text-brand-400">ink</span>
        </span>

        <h1 className="mt-10 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          Your tattoo artists, on one map
        </h1>
        <p className="mt-3 text-pretty text-muted-foreground">
          Artists move between studios, guest spots and conventions. Travelink
          keeps track of where they are.
        </p>

        <ol className="mt-10 grid gap-4 text-left">
          {STEPS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 ring-1 ring-brand-500/20">
                <Icon className="size-5 text-brand-400/90" strokeWidth={1.5} />
              </span>
              <span className="text-sm text-foreground/90">{text}</span>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex gap-3">
          <Link href={registerHref} className={cn(buttonVariants({ size: "lg" }), "px-4")}>
            Get started
          </Link>
          <Link
            href="/login"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "px-4")}
          >
            Sign in
          </Link>
        </div>
      </main>
    </div>
  );
}
