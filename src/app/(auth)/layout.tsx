import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { BrandMark, Chevrons, Halftone, Plus, Readout, RoutingLines, Stamp, Tag } from "@/components/brand/marks";
import { ChromeStage } from "@/components/brand/chrome-stage";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip overflow-y-auto bg-background px-4 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <ChromeStage className="opacity-55 [mask-image:radial-gradient(60%_60%_at_50%_42%,#000,transparent_72%)]" />
        <RoutingLines layout="frame" className="text-foreground/20" />
        <Plus className="absolute top-8 left-8 size-4 text-foreground/50" />
        <Plus className="absolute right-8 bottom-8 size-4 text-foreground/50" />
        <Readout className="absolute top-9 right-8 hidden sm:block">{"//:auth"}</Readout>
        <Halftone className="absolute top-24 right-0 hidden h-16 w-auto rotate-180 text-foreground/15 md:block" />
        <Halftone className="absolute bottom-20 left-0 hidden h-16 w-auto text-foreground/15 md:block" />
        <span className="dr-outline absolute bottom-[-0.12em] left-1/2 hidden -translate-x-1/2 text-[11rem] leading-none whitespace-nowrap lowercase [--outline-c:rgb(201_214_211/0.08)] lg:block">
          travelink
        </span>
        <Stamp id="stamp-auth" text="Travelink • members only • rev 02 • " className="absolute top-[14%] left-[8%] hidden size-24 text-foreground/50 lg:inline-flex">
          <Plus className="size-4 text-brand-500" />
        </Stamp>
        <Chevrons count={5} className="absolute right-[9%] bottom-[16%] hidden h-2.5 w-auto text-foreground/40 lg:block" />
        <Readout className="absolute bottom-9 left-8 hidden sm:block">
          Travelink — <span className="font-jp tracking-[0.1em]">トラベリンク</span>
        </Readout>
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <Link href="/" aria-label="Travelink home">
            <BrandMark className="text-2xl" />
          </Link>
          {/* Balances the back link so the brand stays centred */}
          <span className="w-14" />
        </div>

        <div className="mb-2 flex items-center justify-between">
          <Tag square="bg-brand-500">Members only</Tag>
          <Chevrons count={3} className="h-2.5 w-auto text-brand-500" />
        </div>
        {children}
      </div>
    </div>
  );
}
