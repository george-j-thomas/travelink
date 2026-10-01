"use client"

import { useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { pointer } from "../pointer"
import { damp, useCanvasRect } from "./kit"
import { SpikeBall } from "./spike-ball"
import { Stage } from "./stage"
import type { MetalSceneProps } from "./types"

/* The Metalheart column: chrome and gunmetal spheres skewered on a rod,
   with a spinning spiked ball at its heart. The sphere level with the
   cursor swells and is drawn toward it; the column sways like a chain. */

type Bead = { radius: number; kind: "chrome" | "gun" | "spike" }

const BEADS: Bead[] = [
  { radius: 0.3, kind: "chrome" },
  { radius: 0.42, kind: "gun" },
  { radius: 0.55, kind: "chrome" },
  { radius: 0.95, kind: "spike" },
  { radius: 0.55, kind: "chrome" },
  { radius: 0.42, kind: "gun" },
  { radius: 0.3, kind: "chrome" },
]
const GAP = 0.16

const layout = (() => {
  const total = BEADS.reduce((sum, b) => sum + b.radius * 2, 0) + GAP * (BEADS.length - 1)
  let y = total / 2
  return BEADS.map((b) => {
    const centre = y - b.radius
    y -= b.radius * 2 + GAP
    return { ...b, y: centre }
  })
})()
const TOP = layout[0].y + layout[0].radius
const BOTTOM = layout[layout.length - 1].y - layout[layout.length - 1].radius

const projected = new THREE.Vector3()

function Column({ still }: { still: boolean }) {
  const camera = useThree((st) => st.camera)
  const rect = useCanvasRect()
  const beads = useRef<(THREE.Group | null)[]>([])
  const time = useRef(0)

  useFrame((_, delta) => {
    if (still) return
    const dt = Math.min(delta, 0.05)
    time.current += dt
    const t = time.current
    const r = rect()
    const k = damp(5, dt)
    layout.forEach((bead, i) => {
      const g = beads.current[i]
      if (!g) return
      projected.set(0, bead.y, 0).project(camera)
      const sx = r.left + ((projected.x + 1) / 2) * r.width
      const sy = r.top + ((1 - projected.y) / 2) * r.height
      const pull = pointer.active
        ? Math.exp(-(((sy - pointer.y) / 95) ** 2)) * THREE.MathUtils.clamp(1 - Math.abs(pointer.x - sx) / 750, 0, 1)
        : Math.exp(-(((i - 3 - Math.sin(t * 0.4) * 3) / 0.9) ** 2)) * 0.7
      const lean = pointer.active ? THREE.MathUtils.clamp((pointer.x - sx) / 420, -1, 1) : Math.sin(t * 0.6)
      const sway = Math.sin(t * 1.1 + i * 0.75) * 0.05
      g.position.x += (sway + lean * 0.32 * pull - g.position.x) * k
      const scale = 1 + (bead.kind === "spike" ? 0.12 : 0.22) * pull
      g.scale.setScalar(g.scale.x + (scale - g.scale.x) * k)
    })
  })

  return (
    <group>
      <mesh position={[0, (TOP + BOTTOM) / 2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, TOP - BOTTOM + 1.6, 12]} />
        <meshStandardMaterial color="#5b666e" metalness={1} roughness={0.22} />
      </mesh>
      {layout.slice(0, -1).map((bead, i) => (
        <mesh key={`ring-${i}`} position={[0, bead.y - bead.radius - GAP / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.026, 10, 32]} />
          <meshStandardMaterial color="#e3e9ec" metalness={1} roughness={0.05} />
        </mesh>
      ))}
      {[TOP + 0.75, BOTTOM - 0.75].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <coneGeometry args={[0.07, 0.5, 16]} />
          <meshStandardMaterial color="#cfd8dd" metalness={1} roughness={0.08} />
        </mesh>
      ))}
      {layout.map((bead, i) => (
        <group
          key={i}
          position={[0, bead.y, 0]}
          ref={(el) => {
            beads.current[i] = el
          }}
        >
          {bead.kind === "spike" ? (
            <SpikeBall
              count={56}
              core={0.5}
              length={[0.38, 0.62]}
              width={[0.05, 0.08]}
              seed={4}
              chromeEvery={2}
              longEvery={0}
              spin={0.45}
              reach={0.55}
              still={still}
            />
          ) : (
            <mesh>
              <sphereGeometry args={[bead.radius, 48, 32]} />
              <meshStandardMaterial
                color={bead.kind === "chrome" ? "#e2e8eb" : "#59646c"}
                metalness={1}
                roughness={bead.kind === "chrome" ? 0.04 : 0.2}
              />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

export function SpheresScene({ active, reducedMotion }: MetalSceneProps) {
  return (
    <Stage active={active} reducedMotion={reducedMotion} camera={{ position: [0, 0, 17], fov: 30 }} shimmerOffset={11}>
      <Column still={reducedMotion} />
    </Stage>
  )
}
