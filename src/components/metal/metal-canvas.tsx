"use client"

import { Component, useEffect, useRef, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"

import type { MetalSceneOptions } from "./scenes/types"

const MetalScene = dynamic(() => import("./scenes"), { ssr: false })

let webgl: boolean | null = null
function hasWebGL() {
  if (webgl === null) {
    try {
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl")
      webgl = !!gl
      gl?.getExtension("WEBGL_lose_context")?.loseContext()
    } catch {
      webgl = false
    }
  }
  return webgl
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * A decorative WebGL metal piece. Loads three.js lazily, mounts the canvas
 * the first time it nears the viewport, and pauses rendering while it is
 * off screen. Without WebGL it shows `fallback` (e.g. a CSS SpikeStar).
 * Size and place it with `className`; it never takes pointer events.
 */
export function MetalCanvas({
  className,
  fallback = null,
  ...options
}: MetalSceneOptions & { className?: string; fallback?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<"idle" | "on" | "off" | "unsupported">("idle")
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!hasWebGL()) {
      setStatus("unsupported")
      return
    }
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    const observer = new IntersectionObserver(
      ([entry]) => setStatus((prev) => (entry.isIntersecting ? "on" : prev === "idle" ? "idle" : "off")),
      { rootMargin: "200px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={ref} aria-hidden="true" className={cn("pointer-events-none", className)}>
      {status === "unsupported" ? (
        fallback
      ) : status !== "idle" ? (
        <SceneBoundary fallback={fallback}>
          <MetalScene {...options} active={status === "on"} reducedMotion={reducedMotion} />
        </SceneBoundary>
      ) : null}
    </div>
  )
}
