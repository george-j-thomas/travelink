import type { ReactNode } from "react"
import { Navbar } from "@/components/navbar"
import { BioQueueProvider } from "@/components/bio-queue"

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="dark relative flex min-h-dvh flex-col bg-background">
      <BioQueueProvider>
        <Navbar />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </BioQueueProvider>
    </div>
  )
}
