"use client"

import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

import { seeded } from "../random"
import { UP, fibonacciSphere, taperedTube, useDisposable } from "./kit"
import { SpikeBall } from "./spike-ball"
import { Stage } from "./stage"
import type { MetalSceneProps } from "./types"

/** Curved chrome claws growing out of the core, swaying slightly. */
function Tendrils({ core, count, seed, still }: { core: number; count: number; seed: number; still: boolean }) {
  const material = useDisposable(
    () => new THREE.MeshStandardMaterial({ color: "#e2e9ec", metalness: 1, roughness: 0.05 })
  )
  const [items] = useState(() => {
    const rnd = seeded(seed)
    return fibonacciSphere(count, 0.6, rnd).map((dir) => {
      const len = 1.7 + rnd() * 1.1
      const curl = 0.45 + rnd() * 0.75
      const geometry = taperedTube(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, len * 0.34, 0),
          new THREE.Vector3(curl * 0.22, len * 0.66, 0),
          new THREE.Vector3(curl * 0.72, len * 0.9, 0),
          new THREE.Vector3(curl * 1.4, len * 0.97, 0),
        ],
        0.07 + rnd() * 0.035
      )
      const quat = new THREE.Quaternion()
        .setFromUnitVectors(UP, dir)
        .multiply(new THREE.Quaternion().setFromAxisAngle(UP, rnd() * Math.PI * 2))
      return { geometry, position: dir.clone().multiplyScalar(core * 0.85), quat, phase: rnd() * Math.PI * 2 }
    })
  })
  useEffect(() => () => items.forEach((item) => item.geometry.dispose()), [items])

  const sway = useRef<(THREE.Group | null)[]>([])
  const time = useRef(seed)
  useFrame((_, delta) => {
    if (still) return
    time.current += Math.min(delta, 0.05)
    const t = time.current
    items.forEach((item, i) => {
      const g = sway.current[i]
      if (!g) return
      g.rotation.z = Math.sin(t * 0.8 + item.phase) * 0.14
      g.rotation.x = Math.sin(t * 0.55 + item.phase * 1.3) * 0.09
    })
  })

  return items.map((item, i) => (
    <group key={i} position={item.position} quaternion={item.quat}>
      <group
        ref={(el) => {
          sway.current[i] = el
        }}
      >
        <mesh geometry={item.geometry} material={material} />
      </group>
    </group>
  ))
}

/** Thin chrome orbit with beads riding it. */
function OrbitRing({ radius, still }: { radius: number; still: boolean }) {
  const ring = useRef<THREE.Group>(null)
  const time = useRef(0)
  useFrame((_, delta) => {
    if (still || !ring.current) return
    time.current += Math.min(delta, 0.05)
    ring.current.rotation.z = time.current * 0.32
  })
  return (
    <group rotation={[1.15, 0.25, 0.3]}>
      <group ref={ring}>
        <mesh>
          <torusGeometry args={[radius, 0.016, 12, 160]} />
          <meshStandardMaterial color="#d9e1e5" metalness={1} roughness={0.08} />
        </mesh>
        {[0, 2.2, 3.9].map((a, i) => (
          <mesh key={a} position={[Math.cos(a) * radius, Math.sin(a) * radius, 0]}>
            <sphereGeometry args={[i === 0 ? 0.11 : 0.07, 24, 16]} />
            <meshStandardMaterial color={i === 1 ? "#a9c8f0" : "#e6ecef"} metalness={1} roughness={0.05} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** The hero piece: a big rotating chrome urchin. */
export function UrchinScene({ active, reducedMotion }: MetalSceneProps) {
  return (
    <Stage active={active} reducedMotion={reducedMotion} camera={{ position: [0, 0, 11], fov: 32 }}>
      <group rotation={[0.25, 0, -0.15]}>
        <SpikeBall
          count={150}
          core={0.82}
          length={[0.75, 1.45]}
          width={[0.06, 0.11]}
          seed={7}
          chromeEvery={3}
          longEvery={6}
          spin={0.14}
          reach={0.8}
          still={reducedMotion}
        >
          <Tendrils core={0.82} count={9} seed={21} still={reducedMotion} />
        </SpikeBall>
        <OrbitRing radius={2.75} still={reducedMotion} />
      </group>
    </Stage>
  )
}
