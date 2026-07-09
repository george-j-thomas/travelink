import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/artists");

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      {/* Warm ambient glow — matches auth pages */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-amber-900/[0.07] blur-[100px]"
      />

      <div className="relative flex flex-col items-center gap-8">
        {/* Brand mark */}
        <h1 className="select-none text-lg font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Travel
          <span className="text-amber-500">ink</span>
        </h1>

        <p className="max-w-sm text-center text-muted-foreground">
          Track your favorite tattoo artists around the world
        </p>

        <div className="flex gap-4">
          <Link href="/register" className={buttonVariants()}>
            Get Started
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline" })}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
