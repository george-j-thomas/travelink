import type { ReactNode } from "react"
import { Navbar } from "@/components/navbar"
import { BioQueueProvider } from "@/components/bio-queue"
import { RoutingLines } from "@/components/brand/marks"
import { SpikeStar } from "@/components/metal/ornaments"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark relative flex min-h-dvh flex-col bg-background">
      {/* Ambient chrome: static routing lines and big spike stars bleeding
          off the edges that shimmer and tilt with the cursor */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <RoutingLines layout="frame" pulses={false} className="text-gun-300/10" />
        <SpikeStar className="absolute top-28 -right-32 size-56 opacity-20 md:-right-28 md:size-80 md:opacity-30" points={15} seed={71} />
        <SpikeStar className="absolute -bottom-24 -left-28 size-56 opacity-20 md:-left-24 md:size-72 md:opacity-25" points={12} seed={72} tone="ice" />
      </div>

      <BioQueueProvider>
        <Navbar />

        <main className="relative flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </BioQueueProvider>
    </div>
  )
}
