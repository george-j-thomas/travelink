"use client"

import { Component, type ReactNode } from "react"
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"

const ChromeArtifact = dynamic(() => import("./chrome-artifact"), {
  ssr: false,
  loading: () => <ChromeFallback />,
})

/** Static chrome blob shown before the canvas loads or if WebGL is absent. */
function ChromeFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative size-2/3">
        <div className="absolute inset-0 animate-pulse-glow rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute inset-[18%] rounded-full bg-[radial-gradient(circle_at_30%_25%,#d6e6e4,#6b7b7d_38%,#161d20_78%)] shadow-[inset_0_2px_10px_rgb(255_255_255/0.4),0_30px_60px_-20px_rgb(0_0_0/0.8)]" />
        <div className="absolute inset-[34%] rounded-full bg-[radial-gradient(circle_at_65%_30%,#8bcff0,#2f74e6_55%,#0a1013_90%)] opacity-70 mix-blend-screen blur-[2px]" />
      </div>
    </div>
  )
}

/** Error boundary so a WebGL failure degrades to the static chrome blob. */
class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) return <ChromeFallback />
    return this.props.children
  }
}

export function ChromeStage({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <WebGLBoundary>
        <ChromeArtifact />
      </WebGLBoundary>
    </div>
  )
}
