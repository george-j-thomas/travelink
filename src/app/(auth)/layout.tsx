import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { BrandMark, Chevrons, Plus, Readout, RoutingLines, Tag } from "@/components/brand/marks";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip overflow-y-auto bg-background px-4 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <RoutingLines layout="frame" className="text-foreground/25" />
        <Plus className="absolute top-8 left-8 size-4 text-foreground/50" />
        <Plus className="absolute right-8 bottom-8 size-4 text-foreground/50" />
        <Readout className="absolute top-9 right-8 hidden sm:block">{"//:auth"}</Readout>
        <Readout className="absolute bottom-9 left-8 hidden sm:block">
          Travelink — <span className="font-display tracking-[0.1em]">トラベリンク</span>
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
