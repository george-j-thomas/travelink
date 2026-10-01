"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import * as THREE from "three"

import { pointer } from "../pointer"
import { seeded } from "../random"
import { UP, clamp01, damp, fibonacciSphere, thornGeometry, useCanvasRect, useDisposable } from "./kit"
import { Stage } from "./stage"
import type { MetalSceneProps, RailLayout } from "./types"

/* A chrome conduit bristling with thorns, in screen pixels (orthographic,
   1 unit = 1 CSS px). Thorns near the cursor stretch out and aim at it, a
   slow wave runs down the rest, and the spiked collars ("maces") spin up
   like drills as the cursor passes. "band" runs horizontally with spikes
   both ways; "left"/"right" run down a screen edge with spikes inward. */

const RAIL_RADIUS = 6
/** Vertical rails sit this far in from the canvas's outer edge */
const EDGE = 32
const MACE_THORNS = 11

const Z = new THREE.Vector3(0, 0, 1)
const FRAMES: Record<RailLayout, { axis: THREE.Vector3; perp: THREE.Vector3 }> = {
  band: { axis: new THREE.Vector3(1, 0, 0), perp: new THREE.Vector3(0, 1, 0) },
  left: { axis: new THREE.Vector3(0, 1, 0), perp: new THREE.Vector3(1, 0, 0) },
  right: { axis: new THREE.Vector3(0, 1, 0), perp: new THREE.Vector3(-1, 0, 0) },
}

const TINTS = {
  gun: ["#56626b", "#66727b", "#4a555d", "#74818a"],
  chrome: ["#e3e9ec", "#cbd5da", "#a9c8f0", "#a6e8d6"],
}

type RailThorn = {
  along: number
  side: 1 | -1
  base: THREE.Vector3
  rest: THREE.Vector3
  dir: THREE.Vector3
  len: number
  width: number
  phase: number
  cur: number
  chrome: boolean
}

type Mace = { along: number; angle: number; boost: number }

function buildRail(layout: RailLayout, span: number) {
  const { axis, perp } = FRAMES[layout]
  const vertical = layout !== "band"
  const rnd = seeded(vertical ? 41 : 17)
  const spacing = vertical ? 12 : 14
  const start = -span / 2 - 50
  const thorns: RailThorn[] = []
  for (let i = 0; start + i * spacing < span / 2 + 50; i++) {
    const along = start + i * spacing + (rnd() - 0.5) * 5
    const side: 1 | -1 = vertical ? (rnd() < 0.78 ? 1 : -1) : rnd() < 0.5 ? 1 : -1
    const long = rnd() < 0.16
    const len =
      vertical && side === -1
        ? 7 + rnd() * 9
        : long
          ? (vertical ? 50 : 40) + rnd() * 16
          : 15 + rnd() * (vertical ? 26 : 22)
    const tilt = (rnd() - 0.5) * 1.15
    const lean = (rnd() - 0.5) * 0.5
    const rest = new THREE.Vector3()
      .addScaledVector(perp, side * Math.cos(tilt))
      .addScaledVector(Z, Math.sin(tilt))
      .addScaledVector(axis, lean)
      .normalize()
    thorns.push({
      along,
      side,
      base: new THREE.Vector3().addScaledVector(axis, along).addScaledVector(perp, side * RAIL_RADIUS * 0.55),
      rest,
      dir: rest.clone(),
      len,
      width: (long ? 3.4 : 2.8) + rnd() * 2.6,
      phase: rnd() * Math.PI * 2,
      cur: len * 0.85,
      chrome: i % 4 === 1,
    })
  }

  const collars: number[] = []
  for (let a = -span / 2 + 70; a < span / 2; a += 150) collars.push(a)
  const maces: Mace[] = []
  for (let a = -span / 2 + 145; a < span / 2 - 20; a += 300) maces.push({ along: a, angle: rnd() * 6, boost: 0 })
  const maceDirs = fibonacciSphere(MACE_THORNS, 0.25, rnd).map((dir) => ({
    dir,
    quat: new THREE.Quaternion().setFromUnitVectors(UP, dir),
    len: 13 + rnd() * 9,
  }))
  return { thorns, collars, maces, maceDirs }
}

const m = new THREE.Matrix4()
const s = new THREE.Vector3()
const q = new THREE.Quaternion()
const q2 = new THREE.Quaternion()
const v = new THREE.Vector3()
const to = new THREE.Vector3()

function RailBody({
  layout,
  span,
  offsetX,
  still,
}: {
  layout: RailLayout
  span: number
  offsetX: number
  still: boolean
}) {
  const { axis, perp } = FRAMES[layout]
  const vertical = layout !== "band"
  const rect = useCanvasRect()
  const thornGeo = useDisposable(() => thornGeometry(10, 10, 1.5))
  const [{ thorns, collars, maces, maceDirs }] = useState(() => buildRail(layout, span))
  const [axisQuat] = useState(() => new THREE.Quaternion().setFromUnitVectors(UP, axis))
  const [ringQuat] = useState(() => new THREE.Quaternion().setFromUnitVectors(Z, axis))

  const thornMesh = useRef<THREE.InstancedMesh>(null)
  const collarMesh = useRef<THREE.InstancedMesh>(null)
  const ringMesh = useRef<THREE.InstancedMesh>(null)
  const coreMesh = useRef<THREE.InstancedMesh>(null)
  const maceMesh = useRef<THREE.InstancedMesh>(null)
  const time = useRef(layout === "right" ? 7 : 0)

  useLayoutEffect(() => {
    const color = new THREE.Color()
    const rnd = seeded(5)
    thorns.forEach((t, i) => {
      const tints = t.chrome ? TINTS.chrome : TINTS.gun
      thornMesh.current?.setColorAt(i, color.set(tints[Math.floor(rnd() * tints.length)]))
    })
    if (thornMesh.current?.instanceColor) thornMesh.current.instanceColor.needsUpdate = true

    collars.forEach((a, i) => {
      v.copy(axis).multiplyScalar(a)
      collarMesh.current?.setMatrixAt(i, m.compose(v, axisQuat, s.set(1, 1, 1)))
      for (const k of [0, 1]) {
        v.copy(axis).multiplyScalar(a + (k ? 7 : -7))
        ringMesh.current?.setMatrixAt(i * 2 + k, m.compose(v, ringQuat, s.set(1, 1, 1)))
      }
    })
    maces.forEach((mace, i) => {
      v.copy(axis).multiplyScalar(mace.along)
      coreMesh.current?.setMatrixAt(i, m.compose(v, q.identity(), s.set(1, 1, 1)))
    })
    for (const mesh of [collarMesh.current, ringMesh.current, coreMesh.current]) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true
    }
  }, [thorns, collars, maces, axis, axisQuat, ringQuat])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    if (!still) time.current += dt
    const t = time.current

    // Pointer in rail-local px (y up); a virtual one patrols when idle
    let pAlong: number
    let pPerp: number
    let live = 0
    if (!still) {
      if (pointer.active) {
        const r = rect()
        const px = pointer.x - r.left - r.width / 2 - offsetX
        const py = -(pointer.y - r.top - r.height / 2)
        pAlong = px * axis.x + py * axis.y
        pPerp = px * perp.x + py * perp.y
        live = 1
      } else {
        pAlong = Math.sin(t * 0.33) * span * 0.42
        pPerp = vertical ? 170 : Math.sin(t * 0.21) >= 0 ? 110 : -110
        live = 0.8
      }
    } else {
      pAlong = 0
      pPerp = 0
    }
    const pointX = axis.x * pAlong + perp.x * pPerp
    const pointY = axis.y * pAlong + perp.y * pPerp
    const sigma = vertical ? 110 : 95
    const reachPerp = vertical ? 560 : 360
    const lunge = vertical ? 1.5 : 1.25
    const near = clamp01(1 - (Math.abs(pPerp) - 20) / reachPerp) * live
    const ease = damp(still ? 1000 : 10, dt)

    const mesh = thornMesh.current
    if (mesh) {
      thorns.forEach((th, i) => {
        const da = th.along - pAlong
        const g = Math.exp(-(da * da) / (2 * sigma * sigma))
        const same = Math.sign(pPerp) === th.side ? 1 : 0.22
        const react = g * near * same
        const wave = still ? 0 : 0.12 * Math.sin(t * 2.4 - th.along * 0.03 + th.phase)
        th.cur += (th.len * (0.85 + wave + lunge * react) - th.cur) * ease

        to.set(pointX - th.base.x, pointY - th.base.y, 0).normalize()
        v.copy(th.rest).lerp(to, 0.6 * react).normalize()
        th.dir.lerp(v, ease).normalize()
        q.setFromUnitVectors(UP, th.dir)
        mesh.setMatrixAt(i, m.compose(th.base, q, s.set(th.width, th.cur, th.width)))
      })
      mesh.instanceMatrix.needsUpdate = true
    }

    const maceMeshNow = maceMesh.current
    if (maceMeshNow) {
      maces.forEach((mace, i) => {
        const da = mace.along - pAlong
        const g = Math.exp(-(da * da) / (2 * (sigma * 1.4) ** 2)) * near
        mace.boost += (g - mace.boost) * damp(4, dt)
        if (!still) mace.angle += dt * (0.5 + 6 * mace.boost)
        q2.setFromAxisAngle(axis, mace.angle)
        maceDirs.forEach((d, j) => {
          v.copy(d.dir).applyQuaternion(q2).multiplyScalar(9).addScaledVector(axis, mace.along)
          q.copy(q2).multiply(d.quat)
          maceMeshNow.setMatrixAt(i * MACE_THORNS + j, m.compose(v, q, s.set(2.6, d.len * (1 + 0.45 * mace.boost), 2.6)))
        })
      })
      maceMeshNow.instanceMatrix.needsUpdate = true
    }
  })

  const length = span + 200
  return (
    <>
      <mesh quaternion={axisQuat}>
        <cylinderGeometry args={[RAIL_RADIUS, RAIL_RADIUS, length, 32, 1, true]} />
        <meshStandardMaterial color="#d3dbe0" metalness={1} roughness={0.1} />
      </mesh>
      {vertical && (
        <mesh quaternion={axisQuat} position={[perp.x * -15, 0, 0]}>
          <cylinderGeometry args={[2, 2, length, 12, 1, true]} />
          <meshStandardMaterial color="#64707a" metalness={1} roughness={0.24} />
        </mesh>
      )}
      <instancedMesh ref={collarMesh} args={[undefined, undefined, collars.length]} frustumCulled={false}>
        <cylinderGeometry args={[9.5, 9.5, 12, 28]} />
        <meshStandardMaterial color="#4f5a62" metalness={1} roughness={0.26} />
      </instancedMesh>
      <instancedMesh ref={ringMesh} args={[undefined, undefined, collars.length * 2]} frustumCulled={false}>
        <torusGeometry args={[9.6, 1.6, 10, 36]} />
        <meshStandardMaterial color="#e1e8eb" metalness={1} roughness={0.06} />
      </instancedMesh>
      {maces.length > 0 && (
        <>
          <instancedMesh ref={coreMesh} args={[undefined, undefined, maces.length]} frustumCulled={false}>
            <sphereGeometry args={[10.5, 32, 20]} />
            <meshStandardMaterial color="#dfe6ea" metalness={1} roughness={0.05} />
          </instancedMesh>
          <instancedMesh
            ref={maceMesh}
            args={[thornGeo, undefined, maces.length * MACE_THORNS]}
            frustumCulled={false}
          >
            <meshStandardMaterial color="#c9d3d9" metalness={1} roughness={0.1} />
          </instancedMesh>
        </>
      )}
      <instancedMesh ref={thornMesh} args={[thornGeo, undefined, thorns.length]} frustumCulled={false}>
        <meshStandardMaterial metalness={1} roughness={0.2} />
      </instancedMesh>
    </>
  )
}

function Rail({ layout, still }: { layout: RailLayout; still: boolean }) {
  const size = useThree((st) => st.size)
  const vertical = layout !== "band"
  const span = Math.max(200, Math.ceil((vertical ? size.height : size.width) / 100) * 100)
  const offsetX = layout === "left" ? -size.width / 2 + EDGE : layout === "right" ? size.width / 2 - EDGE : 0
  return (
    <group position={[offsetX, 0, 0]}>
      <RailBody key={span} layout={layout} span={span} offsetX={offsetX} still={still} />
    </group>
  )
}

export function RailScene({ active, reducedMotion, layout }: MetalSceneProps & { scene: "rail" }) {
  return (
    <Stage
      active={active}
      reducedMotion={reducedMotion}
      orthographic
      camera={{ position: [0, 0, 600], zoom: 1, near: 1, far: 2000 }}
      shimmerOffset={layout === "right" ? 9 : layout === "band" ? 4 : 0}
    >
      <Rail layout={layout} still={reducedMotion} />
    </Stage>
  )
}
