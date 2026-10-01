/* Shared pointer state for every reactive metal piece. One set of window
   listeners, ref-counted; consumers read the mutable object each frame. */

export const pointer = {
  /** Client (viewport) position in CSS px */
  x: 0,
  y: 0,
  /** Viewport-normalised position, -1…1 (y grows downward) */
  nx: 0,
  ny: 0,
  /** False until the first move, and after the pointer leaves the window */
  active: false,
}

let users = 0
let layoutVersion = 0

function onMove(e: PointerEvent) {
  pointer.x = e.clientX
  pointer.y = e.clientY
  pointer.nx = (e.clientX / window.innerWidth) * 2 - 1
  pointer.ny = (e.clientY / window.innerHeight) * 2 - 1
  pointer.active = true
}

function onOut(e: MouseEvent) {
  if (!e.relatedTarget) pointer.active = false
}

function onLayout() {
  layoutVersion++
}

/** Start tracking; returns the matching release function. */
export function retainPointer() {
  if (users++ === 0) {
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerdown", onMove, { passive: true })
    document.addEventListener("mouseout", onOut)
    window.addEventListener("scroll", onLayout, { passive: true, capture: true })
    window.addEventListener("resize", onLayout, { passive: true })
  }
  return () => {
    if (--users === 0) {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerdown", onMove)
      document.removeEventListener("mouseout", onOut)
      window.removeEventListener("scroll", onLayout, { capture: true })
      window.removeEventListener("resize", onLayout)
    }
  }
}

/** Bumped on scroll/resize, so cached element rects know to re-measure. */
export function getLayoutVersion() {
  return layoutVersion
}
