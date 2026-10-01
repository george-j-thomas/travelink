import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Barcode, BrandMark, Chevrons, Crosshair, Readout } from "@/components/brand/marks";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip overflow-y-auto bg-background px-4 py-12">
      {/* HUD backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-1 bg-brand-500" />
        <span className="absolute top-1/2 -left-6 hidden -translate-y-1/2 font-display text-[18rem] leading-none font-black uppercase select-none wx-outline [--stroke-c:oklch(1_0_0/5%)] lg:block">
          Tr
        </span>
        <span className="absolute top-1/2 -right-10 hidden -translate-y-1/2 font-display text-[18rem] leading-none font-black uppercase select-none wx-outline [--stroke-c:oklch(1_0_0/5%)] lg:block">
          Ink
        </span>
        <Crosshair className="absolute top-6 left-6 size-6 text-muted-foreground/50" />
        <Crosshair className="absolute right-6 bottom-6 size-6 text-muted-foreground/50" />
        <Readout className="absolute top-8 right-6 hidden sm:block">Auth / secure channel</Readout>
        <Readout className="absolute bottom-8 left-6 hidden sm:block">{"TRV-INK/01 // v1.0"}</Readout>
        <div className="absolute right-0 bottom-0 left-0 h-2 text-brand-500/70 wx-hazard [--stripe:8px]" />
      </div>

      <div className="relative w-full max-w-[400px]">
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[0.65rem] tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Home
          </Link>
          <Link href="/" aria-label="Travelink home">
            <BrandMark className="text-base" />
          </Link>
          {/* Balances the back link so the brand stays centred */}
          <span className="w-14" />
        </div>

        {/* Hard red offset slab behind the card */}
        <div className="relative">
          <div aria-hidden="true" className="absolute inset-0 translate-x-2 translate-y-2 bg-brand-500" />
          <div className="relative">{children}</div>
        </div>

        <div aria-hidden="true" className="mt-8 flex items-center justify-between">
          <Chevrons count={4} className="h-2.5 w-auto text-brand-500" />
          <Barcode seed={9} className="h-4 w-20 text-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}
