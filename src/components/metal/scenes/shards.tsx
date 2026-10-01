"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { pointer } from "../pointer"
import { seeded } from "../random"
import { UP, damp, pointerOnPlane, shardGeometry, smoothstep, useCanvasRect, useDisposable } from "./kit"
import { Stage } from "./stage"
import type { MetalSceneProps, ShardLayout } from "./types"

/* Faceted crystal shards bursting from a point. They don't rotate: the
   studio light slides over their facets, the shards nearest the cursor's
   direction lean toward it and stretch, and the rest breathe. */

const VARIANTS = 3
const TINTS = ["#a9c8f0", "#86aee6", "#5a6670", "#d0d9de", "#9fe3cf", "#6c7983", "#bcd6f5"]

type Shard = {
  rest: THREE.Vector3
  dir: THREE.Vector3
  len: number
  width: number
  phase: number
  cur: number
  variant: number
  slot: number
}

type ClusterProps = {
  anchor: [number, number, number]
  axis: [number, number, number]
  /** Cone half-angle in radians (Math.PI = all directions) */
  spread: number
  count: number
  length: [number, number]
  width: [number, number]
  seed: number
  /** Squash directions toward the screen plane (burst flowers) */
  flatten?: number
  still: boolean
}

const m = new THREE.Matrix4()
const s = new THREE.Vector3()
const q = new THREE.Quaternion()
const v = new THREE.Vector3()
const to = new THREE.Vector3()
const target = new THREE.Vector3()
const anchorV = new THREE.Vector3()

function Cluster({ anchor, axis, spread, count, length, width, seed, flatten = 0, still }: ClusterProps) {
  const camera = useThree((st) => st.camera)
  const viewport = useThree((st) => st.viewport)
  const rect = useCanvasRect()
  const geo0 = useDisposable(() => shardGeometry(seed * 3 + 1, 5))
  const geo1 = useDisposable(() => shardGeometry(seed * 3 + 2, 4, 0.16))
  const geo2 = useDisposable(() => shardGeometry(seed * 3 + 3, 6, 0.26))
  const geometries = [geo0, geo1, geo2]
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([])

  const [shards] = useState(() => {
    const rnd = seeded(seed)
    const a = new THREE.Vector3(...axis).normalize()
    const u = new THREE.Vector3().crossVectors(a, Math.abs(a.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : UP).normalize()
    const w = new THREE.Vector3().crossVectors(a, u)
    const slots = [0, 0, 0]
    return Array.from({ length: count }, (_, i): Shard => {
      const theta = rnd() * Math.PI * 2
      const phi = Math.sqrt(rnd()) * spread
      const dir = new THREE.Vector3()
        .addScaledVector(a, Math.cos(phi))
        .addScaledVector(u, Math.sin(phi) * Math.cos(theta))
        .addScaledVector(w, Math.sin(phi) * Math.sin(theta))
      if (flatten) dir.z *= 1 - flatten
      dir.normalize()
      // Longest along the axis, shorter toward the rim of the cone
      const falloff = 1 - 0.45 * (phi / Math.max(spread, 0.001))
      const len = THREE.MathUtils.lerp(length[0], length[1], rnd() ** 1.4) * falloff
      const variant = i % VARIANTS
      return {
        rest: dir,
        dir: dir.clone(),
        len,
        width: THREE.MathUtils.lerp(width[0], width[1], rnd()),
        phase: rnd() * Math.PI * 2,
        cur: len,
        variant,
        slot: slots[variant]++,
      }
    })
  })
  const perVariant = [0, 1, 2].map((k) => shards.filter((sh) => sh.variant === k).length)

  useLayoutEffect(() => {
    const color = new THREE.Color()
    const rnd = seeded(seed + 5)
    for (const sh of shards) {
      meshes.current[sh.variant]?.setColorAt(sh.slot, color.set(TINTS[Math.floor(rnd() * TINTS.length)]))
    }
    for (const mesh of meshes.current) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [shards, seed])

  const time = useRef(seed)
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    if (!still) time.current += dt
    const t = time.current
    anchorV.set(...anchor)

    let prox = 0
    if (!still) {
      if (pointer.active) {
        pointerOnPlane(camera, rect(), 0, target)
        prox = THREE.MathUtils.clamp(1.35 - target.distanceTo(anchorV) / (Math.max(viewport.width, viewport.height) * 0.55), 0.2, 1)
      } else {
        target.set(Math.cos(t * 0.31) * viewport.width * 0.3, Math.sin(t * 0.23) * viewport.height * 0.3, 0)
        prox = 0.55
      }
    }

    const ease = damp(still ? 1000 : 6, dt)
    to.copy(target).sub(anchorV).normalize()
    for (const sh of shards) {
      let stretch = 1
      if (!still) {
        const react = smoothstep(0.5, 0.97, sh.rest.dot(to)) * prox
        v.copy(sh.rest).lerp(to, 0.32 * react).normalize()
        sh.dir.lerp(v, ease).normalize()
        stretch = 1 + 0.05 * Math.sin(t * 1.25 + sh.phase) + 0.4 * react
      }
      sh.cur += (sh.len * stretch - sh.cur) * ease
      q.setFromUnitVectors(UP, sh.dir)
      meshes.current[sh.variant]?.setMatrixAt(sh.slot, m.compose(anchorV, q, s.set(sh.width, sh.cur, sh.width)))
    }
    for (const mesh of meshes.current) if (mesh) mesh.instanceMatrix.needsUpdate = true
  })

  return geometries.map((geometry, k) =>
    perVariant[k] > 0 ? (
      <instancedMesh
        key={k}
        ref={(el) => {
          meshes.current[k] = el
        }}
        args={[geometry, undefined, perVariant[k]]}
        frustumCulled={false}
      >
        <meshStandardMaterial metalness={1} roughness={k === 1 ? 0.18 : 0.07} />
      </instancedMesh>
    ) : null
  )
}

/** Two shard clusters bursting in from the screen edges (auth pages). */
function Sides({ still }: { still: boolean }) {
  const { width, height } = useThree((st) => st.viewport)
  const portrait = width / height < 0.85
  const unit = Math.min(width, height)
  const length: [number, number] = [unit * 0.16, unit * (portrait ? 0.5 : 0.62)]
  const widthRange: [number, number] = [unit * 0.012, unit * 0.034]

  return portrait ? (
    <>
      <Cluster
        key={`tr-${Math.round(width * 10)}-${Math.round(height * 10)}`}
        anchor={[width / 2 + unit * 0.06, height / 2 + unit * 0.04, -1.2]}
        axis={[-1, -1.2, 0.25]}
        spread={0.7}
        count={30}
        length={length}
        width={widthRange}
        seed={3}
        still={still}
      />
      <Cluster
        key={`bl-${Math.round(width * 10)}-${Math.round(height * 10)}`}
        anchor={[-width / 2 - unit * 0.06, -height / 2 - unit * 0.04, -1.2]}
        axis={[1, 1.2, 0.25]}
        spread={0.7}
        count={30}
        length={length}
        width={widthRange}
        seed={8}
        still={still}
      />
    </>
  ) : (
    <>
      <Cluster
        key={`l-${Math.round(width * 10)}-${Math.round(height * 10)}`}
        anchor={[-width / 2 - unit * 0.05, -height * 0.16, -1.2]}
        axis={[1, 0.28, 0.3]}
        spread={0.82}
        count={38}
        length={length}
        width={widthRange}
        seed={3}
        still={still}
      />
      <Cluster
        key={`r-${Math.round(width * 10)}-${Math.round(height * 10)}`}
        anchor={[width / 2 + unit * 0.05, height * 0.2, -1.2]}
        axis={[-1, -0.22, 0.3]}
        spread={0.82}
        count={38}
        length={length}
        width={widthRange}
        seed={8}
        still={still}
      />
    </>
  )
}

/** A flat-ish crystal starburst around a chrome bead that banks to face
    the cursor. */
function Burst({ still }: { still: boolean }) {
  const group = useRef<THREE.Group>(null)
  const time = useRef(0)
  useFrame((_, delta) => {
    const g = group.current
    if (still || !g) return
    const dt = Math.min(delta, 0.05)
    time.current += dt
    const k = damp(2, dt)
    const ty = pointer.active ? pointer.nx * 0.45 : Math.sin(time.current * 0.3) * 0.25
    const tx = pointer.active ? pointer.ny * 0.35 : Math.cos(time.current * 0.25) * 0.15
    g.rotation.y += (ty - g.rotation.y) * k
    g.rotation.x += (tx - g.rotation.x) * k
  })
  return (
    <group ref={group}>
      <Cluster
        anchor={[0, 0, 0]}
        axis={[0, 0, 1]}
        spread={Math.PI}
        flatten={0.72}
        count={30}
        length={[0.9, 2.3]}
        width={[0.07, 0.17]}
        seed={13}
        still={still}
      />
      <mesh>
        <sphereGeometry args={[0.34, 40, 28]} />
        <meshStandardMaterial color="#e3e9ec" metalness={1} roughness={0.04} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.045, 14, 64]} />
        <meshStandardMaterial color="#56616a" metalness={1} roughness={0.2} />
      </mesh>
    </group>
  )
}

export function ShardsScene({ active, reducedMotion, layout }: MetalSceneProps & { scene: "shards"; layout: ShardLayout }) {
  return (
    <Stage
      active={active}
      reducedMotion={reducedMotion}
      camera={layout === "sides" ? { position: [0, 0, 14], fov: 35 } : { position: [0, 0, 8], fov: 35 }}
      shimmerOffset={layout === "sides" ? 2 : 6}
    >
      {layout === "sides" ? <Sides still={reducedMotion} /> : <Burst still={reducedMotion} />}
    </Stage>
  )
}
