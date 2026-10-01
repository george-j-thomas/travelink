"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { pointer } from "../pointer"
import { seeded } from "../random"
import {
  UP,
  createBristle,
  damp,
  fibonacciSphere,
  pointerOnPlane,
  smoothstep,
  thornGeometry,
  useCanvasRect,
  useDisposable,
} from "./kit"

const GUN_TINTS = ["#5a6670", "#6a7680", "#4b565e", "#78858e"]
const CHROME_TINTS = ["#e6ecef", "#cfd8dd", "#a9c8f0", "#a6e8d6", "#dde5e9"]

type Thorn = {
  base: THREE.Vector3
  dir: THREE.Vector3
  quat: THREE.Quaternion
  len: number
  width: number
  phase: number
  cur: number
  chrome: boolean
  slot: number
}

export type SpikeBallProps = {
  count: number
  core: number
  length: [number, number]
  width: [number, number]
  seed?: number
  /** Every nth thorn is mirror chrome, the rest gunmetal */
  chromeEvery?: number
  /** Every nth thorn is extra long */
  longEvery?: number
  /** Spin speed, rad/s (0 = only shimmers) */
  spin?: number
  /** How far thorns lunge toward the pointer, as a fraction of their length */
  reach?: number
  still?: boolean
  position?: [number, number, number]
  scale?: number
  /** Extra parts that spin with the ball (tendrils, bands) */
  children?: ReactNode
}

const m = new THREE.Matrix4()
const s = new THREE.Vector3()
const centre = new THREE.Vector3()
const attractor = new THREE.Vector3()
const inverse = new THREE.Quaternion()

/**
 * A gunmetal core bristling with lathe-turned thorns. Thorns aimed at the
 * pointer lunge out, the far side recoils, fast pointer movement makes the
 * whole ball bristle, and it banks to face the cursor.
 */
export function SpikeBall({
  count,
  core,
  length,
  width,
  seed = 1,
  chromeEvery = 3,
  longEvery = 7,
  spin = 0.15,
  reach = 0.85,
  still = false,
  position,
  scale,
  children,
}: SpikeBallProps) {
  const outer = useRef<THREE.Group>(null)
  const spinner = useRef<THREE.Group>(null)
  const gunMesh = useRef<THREE.InstancedMesh>(null)
  const chromeMesh = useRef<THREE.InstancedMesh>(null)
  const camera = useThree((st) => st.camera)
  const rect = useCanvasRect()
  const geometry = useDisposable(() => thornGeometry())

  const [thorns] = useState(() => {
    const rnd = seeded(seed)
    let gun = 0
    let chrome = 0
    return fibonacciSphere(count, 0.22, rnd).map((dir, i): Thorn => {
      const isChrome = chromeEvery > 0 && i % chromeEvery === 0
      const long = longEvery > 0 && i % longEvery === 3
      const len = THREE.MathUtils.lerp(length[0], length[1], rnd()) * (long ? 1.35 : 1)
      return {
        base: dir.clone().multiplyScalar(core * 0.9),
        dir,
        quat: new THREE.Quaternion().setFromUnitVectors(UP, dir),
        len,
        width: THREE.MathUtils.lerp(width[0], width[1], rnd()) * (long ? 0.85 : 1),
        phase: rnd() * Math.PI * 2,
        cur: len * 0.8,
        chrome: isChrome,
        slot: isChrome ? chrome++ : gun++,
      }
    })
  })
  const chromeCount = thorns.filter((t) => t.chrome).length
  const gunCount = thorns.length - chromeCount

  const state = useRef({ t: seed * 3.7, bristle: createBristle() })

  useLayoutEffect(() => {
    const color = new THREE.Color()
    const rnd = seeded(seed + 11)
    for (const t of thorns) {
      const mesh = t.chrome ? chromeMesh.current : gunMesh.current
      if (!mesh) continue
      const tints = t.chrome ? CHROME_TINTS : GUN_TINTS
      mesh.setColorAt(t.slot, color.set(tints[Math.floor(rnd() * tints.length)]))
    }
    for (const mesh of [gunMesh.current, chromeMesh.current]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [thorns, seed])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const st = state.current
    const group = outer.current
    const spinning = spinner.current
    if (!group || !spinning) return

    let prox = 0
    let bristle = 0
    if (!still) {
      st.t += dt
      spinning.rotation.y += dt * spin
      bristle = st.bristle(dt)

      const r = rect()
      group.getWorldPosition(centre)
      const projected = attractor.copy(centre).project(camera)
      const sx = r.left + ((projected.x + 1) / 2) * r.width
      const sy = r.top + ((1 - projected.y) / 2) * r.height
      const dx = pointer.x - sx
      const dy = pointer.y - sy

      if (pointer.active) {
        const span = Math.max(420, Math.max(r.width, r.height) * 0.9)
        prox = THREE.MathUtils.clamp(1.25 - Math.hypot(dx, dy) / span, 0.25, 1)
        pointerOnPlane(camera, r, centre.z + core * 2.4, attractor).sub(centre)
      } else {
        prox = 0.5
        attractor.set(Math.cos(st.t * 0.5) * 3, Math.sin(st.t * 0.37) * 2, 2.4)
      }
      spinning.getWorldQuaternion(inverse).invert()
      attractor.applyQuaternion(inverse).normalize()

      const k = damp(2.2, dt)
      const tiltY = pointer.active ? THREE.MathUtils.clamp(dx / 700, -1, 1) * 0.5 : Math.sin(st.t * 0.3) * 0.2
      const tiltX = pointer.active ? THREE.MathUtils.clamp(dy / 700, -1, 1) * 0.4 : Math.cos(st.t * 0.23) * 0.12
      group.rotation.y += (tiltY - group.rotation.y) * k
      group.rotation.x += (tiltX - group.rotation.x) * k
    }

    const ease = damp(9, dt)
    const gun = gunMesh.current
    const chrome = chromeMesh.current
    for (const t of thorns) {
      let target = t.len * 0.82
      if (!still) {
        const align = t.dir.dot(attractor)
        const lunge = smoothstep(0.4, 0.96, align) * prox
        const recoil = smoothstep(-0.2, -0.85, align) * prox
        target = t.len * (0.82 + 0.06 * Math.sin(st.t * 1.7 + t.phase) + reach * lunge - 0.16 * recoil + 0.24 * bristle)
      }
      t.cur += (target - t.cur) * (still ? 1 : ease)
      m.compose(t.base, t.quat, s.set(t.width, t.cur, t.width))
      ;(t.chrome ? chrome : gun)?.setMatrixAt(t.slot, m)
    }
    if (gun) gun.instanceMatrix.needsUpdate = true
    if (chrome) chrome.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={outer} position={position} scale={scale}>
      <group ref={spinner}>
        <mesh>
          <sphereGeometry args={[core, 48, 32]} />
          <meshStandardMaterial color="#56616a" metalness={1} roughness={0.2} />
        </mesh>
        {gunCount > 0 && (
          <instancedMesh ref={gunMesh} args={[geometry, undefined, gunCount]} frustumCulled={false}>
            <meshStandardMaterial metalness={1} roughness={0.28} />
          </instancedMesh>
        )}
        {chromeCount > 0 && (
          <instancedMesh ref={chromeMesh} args={[geometry, undefined, chromeCount]} frustumCulled={false}>
            <meshStandardMaterial metalness={1} roughness={0.06} />
          </instancedMesh>
        )}
        {children}
      </group>
    </group>
  )
}
