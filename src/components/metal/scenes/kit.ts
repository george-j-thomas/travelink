import { useEffect, useRef, useState } from "react"
import { useThree } from "@react-three/fiber"
import * as THREE from "three"

import { getLayoutVersion, pointer } from "../pointer"
import { seeded } from "../random"

export const UP = new THREE.Vector3(0, 1, 0)

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export function smoothstep(a: number, b: number, v: number) {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/** Frame-rate independent easing factor. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)

/* ── Geometry ───────────────────────────────────────────────────────── */

/** Lathe thorn: radius 1 at the base (y=0), concave taper to a point at
    y=1. Scale x/z for thickness and y for length. */
export function thornGeometry(radial = 14, rings = 16, power = 1.7) {
  const profile: THREE.Vector2[] = []
  for (let i = 0; i <= rings; i++) {
    const t = i / rings
    profile.push(new THREE.Vector2(Math.max(0.002, Math.pow(1 - t, power)), t))
  }
  return new THREE.LatheGeometry(profile, radial)
}

/** Faceted crystal shard: an irregular bipyramid with its tail just below
    y=0 and its tip at y=1. Non-indexed, so normals come out flat. */
export function shardGeometry(seed: number, sides = 5, mid = 0.2, tail = 0.1) {
  const rnd = seeded(seed)
  const ring: THREE.Vector3[] = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (rnd() - 0.5) * 0.6
    const r = 0.7 + rnd() * 0.55
    ring.push(new THREE.Vector3(Math.cos(a) * r, mid + (rnd() - 0.5) * 0.1, Math.sin(a) * r))
  }
  const tip = new THREE.Vector3((rnd() - 0.5) * 0.1, 1, (rnd() - 0.5) * 0.1)
  const end = new THREE.Vector3(0, -tail, 0)
  const pos: number[] = []
  for (let i = 0; i < sides; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % sides]
    pos.push(a.x, a.y, a.z, tip.x, tip.y, tip.z, b.x, b.y, b.z)
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, end.x, end.y, end.z)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  geometry.computeVertexNormals()
  return geometry
}

/** Tube along a smooth curve whose radius tapers to a point at the end. */
export function taperedTube(
  points: THREE.Vector3[],
  radius: number,
  { tubular = 64, radial = 12, power = 1.15 } = {}
) {
  const curve = new THREE.CatmullRomCurve3(points, false, "centripetal")
  const geometry = new THREE.TubeGeometry(curve, tubular, radius, radial, false)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const centre = new THREE.Vector3()
  const p = new THREE.Vector3()
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular
    curve.getPointAt(u, centre)
    const scale = Math.max(0.004, Math.pow(1 - u, power))
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j
      p.fromBufferAttribute(position, k).sub(centre).multiplyScalar(scale).add(centre)
      position.setXYZ(k, p.x, p.y, p.z)
    }
  }
  position.needsUpdate = true
  geometry.computeBoundingSphere()
  return geometry
}

/** Evenly spread unit vectors, optionally jittered. */
export function fibonacciSphere(count: number, jitter = 0, rnd: () => number = Math.random) {
  const out: THREE.Vector3[] = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count
    const r = Math.sqrt(1 - y * y)
    const v = new THREE.Vector3(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r)
    if (jitter) {
      v.x += (rnd() - 0.5) * jitter
      v.y += (rnd() - 0.5) * jitter
      v.z += (rnd() - 0.5) * jitter
      v.normalize()
    }
    out.push(v)
  }
  return out
}

/* ── Hooks ──────────────────────────────────────────────────────────── */

/** Creates a three.js resource once and disposes it on unmount. */
export function useDisposable<T extends { dispose(): void }>(create: () => T): T {
  const [value] = useState(create)
  useEffect(() => () => value.dispose(), [value])
  return value
}

export type CanvasRect = { left: number; top: number; width: number; height: number }

/** Returns a getter for the canvas's viewport rect, re-measured only after
    scroll/resize (and periodically, to catch layout shifts). */
export function useCanvasRect() {
  const gl = useThree((s) => s.gl)
  const cache = useRef({ version: -1, age: 0, rect: { left: 0, top: 0, width: 1, height: 1 } as CanvasRect })
  return () => {
    const c = cache.current
    const version = getLayoutVersion()
    if (c.version !== version || ++c.age > 45) {
      const r = gl.domElement.getBoundingClientRect()
      c.rect = { left: r.left, top: r.top, width: r.width || 1, height: r.height || 1 }
      c.version = version
      c.age = 0
    }
    return c.rect
  }
}

const ndc = new THREE.Vector3()

/** Projects the pointer onto the world plane z = depth (perspective camera). */
export function pointerOnPlane(camera: THREE.Camera, rect: CanvasRect, depth: number, out: THREE.Vector3) {
  ndc.set(((pointer.x - rect.left) / rect.width) * 2 - 1, -((pointer.y - rect.top) / rect.height) * 2 + 1, 0.5)
  ndc.unproject(camera).sub(camera.position).normalize()
  const t = (depth - camera.position.z) / (ndc.z || -1e-6)
  return out.copy(camera.position).addScaledVector(ndc, t)
}

/** Smoothed pointer speed (0…1), for spikes that bristle when you move fast. */
export function createBristle() {
  let lastX = 0
  let lastY = 0
  let primed = false
  let value = 0
  return (dt: number) => {
    if (!primed) {
      lastX = pointer.x
      lastY = pointer.y
      primed = true
    }
    const speed = Math.hypot(pointer.x - lastX, pointer.y - lastY) / Math.max(dt, 1 / 240)
    lastX = pointer.x
    lastY = pointer.y
    const target = pointer.active ? clamp01(speed / 2400) : 0
    value += (target - value) * damp(target > value ? 10 : 2.2, dt)
    return value
  }
}
