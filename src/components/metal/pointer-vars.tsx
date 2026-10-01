"use client"

import { useEffect } from "react"

import { pointer, retainPointer } from "./pointer"

/**
 * Publishes the eased pointer position as `--mx` / `--my` (-1…1) on <html>.
 * CSS chrome (text, plates, spike stars, screws) reads them to move its
 * reflections with the cursor. Idles when the pointer is still.
 */
export function PointerVars() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const release = retainPointer()
    const root = document.documentElement.style
    let x = 0
    let y = 0
    let frame = 0

    const tick = () => {
      x += (pointer.nx - x) * 0.14
      y += (pointer.ny - y) * 0.14
      root.setProperty("--mx", x.toFixed(4))
      root.setProperty("--my", y.toFixed(4))
      const settled = Math.abs(pointer.nx - x) < 0.001 && Math.abs(pointer.ny - y) < 0.001
      frame = settled ? 0 : requestAnimationFrame(tick)
    }
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    window.addEventListener("pointermove", wake, { passive: true })
    return () => {
      window.removeEventListener("pointermove", wake)
      cancelAnimationFrame(frame)
      release()
    }
  }, [])

  return null
}
