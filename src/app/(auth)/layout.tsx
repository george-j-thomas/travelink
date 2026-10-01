import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { BrandMark, RoutingLines } from "@/components/brand/marks";
import { MetalCanvas } from "@/components/metal/metal-canvas";
import { SpikeStar } from "@/components/metal/ornaments";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip overflow-y-auto bg-background px-4 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <RoutingLines layout="frame" className="text-gun-300/20" />
        <div className="absolute inset-0 bg-[radial-gradient(50%_45%_at_50%_45%,rgb(79_147_245/0.08),transparent_70%)]" />
      </div>
      {/* Chrome shard clusters reaching in from the sides of the viewport */}
      <MetalCanvas
        scene="shards"
        layout="sides"
        className="fixed inset-0"
        fallback={
          <>
            <SpikeStar className="absolute top-[12%] -left-16 size-56" points={14} seed={51} tone="ice" />
            <SpikeStar className="absolute -right-12 bottom-[10%] size-48" points={11} seed={52} />
          </>
        }
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-wide text-[0.62rem] font-bold tracking-[0.2em] text-muted-foreground uppercase transition-colors hover:text-foreground"
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

        <div className="mb-3 flex items-center gap-3">
          <SpikeStar className="size-6" points={8} seed={53} tone="mint" back={false} />
          <span className="font-wide text-[0.62rem] font-bold tracking-[0.28em] text-gun-200 uppercase">Members only</span>
          <span aria-hidden="true" className="flow-line h-px flex-1" />
        </div>
        {children}
      </div>
    </div>
  );
}
