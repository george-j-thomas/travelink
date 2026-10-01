"use client"

import { useEffect, useRef } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Environment, Float, Lightformer } from "@react-three/drei"
import * as THREE from "three"

/* ═══════════════════════════════════════════════════════════════════════
   Metalheart chrome artifact — a cluster of liquid-metal tubes and blobs
   that drift on their own and bank toward the pointer, lit green and blue
   by procedural lightformers (no external HDRI). 90s/00s desktop-art vibe.
   ═══════════════════════════════════════════════════════════════════ */

// Shared, normalised pointer (-1…1) updated from window so the piece reacts
// to movement anywhere on the page, even though the canvas ignores events.
const pointer = { x: 0, y: 0, active: false }

function usePointerTracking() {
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1
      pointer.active = true
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => window.removeEventListener("pointermove", onMove)
  }, [])
}

const chromeMaterial = (color: string, roughness = 0.14) => (
  <meshStandardMaterial
    color={color}
    metalness={1}
    roughness={roughness}
    envMapIntensity={1.4}
  />
)

function MetalCluster({ reducedMotion }: { reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null)
  const knot = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    if (!group.current) return
    const t = state.clock.elapsedTime

    // Idle drift so it never sits still; pointer adds a bank/tilt on top.
    const targetY = reducedMotion ? 0 : t * 0.18 + pointer.x * 0.9
    const targetX = reducedMotion ? 0 : Math.sin(t * 0.25) * 0.12 + pointer.y * 0.6

    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 1 - Math.pow(0.001, delta))
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetX, 1 - Math.pow(0.004, delta))

    if (knot.current && !reducedMotion) {
      knot.current.rotation.z = t * 0.3
    }
  })

  return (
    <group ref={group} scale={1.05}>
      {/* Central knotted chrome tubes — the radiating metalheart core */}
      <mesh ref={knot} castShadow>
        <torusKnotGeometry args={[1, 0.3, 220, 32, 2, 3]} />
        {chromeMaterial("#8b9aa0", 0.1)}
      </mesh>

      {/* Inner polished blob */}
      <mesh scale={0.62}>
        <icosahedronGeometry args={[1, 4]} />
        {chromeMaterial("#aab7ba", 0.08)}
      </mesh>

      {/* Satellite metal droplets drifting around the core */}
      {SATELLITES.map((s, i) => (
        <Float
          key={i}
          speed={reducedMotion ? 0 : 1.4 + i * 0.2}
          rotationIntensity={reducedMotion ? 0 : 1.1}
          floatIntensity={reducedMotion ? 0 : 1.3}
        >
          <mesh position={s.pos} scale={s.scale} castShadow>
            <icosahedronGeometry args={[1, 3]} />
            {chromeMaterial(s.color, 0.12)}
          </mesh>
        </Float>
      ))}

      {/* Thin chrome spikes shooting outward, like the shard renders */}
      {SPIKES.map((s, i) => (
        <mesh key={`sp-${i}`} position={s.pos} rotation={s.rot} scale={s.scale}>
          <coneGeometry args={[0.12, 2.4, 20]} />
          {chromeMaterial("#9fadb1", 0.16)}
        </mesh>
      ))}
    </group>
  )
}

const SATELLITES: { pos: [number, number, number]; scale: number; color: string }[] = [
  { pos: [1.9, 0.7, 0.4], scale: 0.34, color: "#9fb2b2" },
  { pos: [-1.8, -0.6, 0.6], scale: 0.28, color: "#86979b" },
  { pos: [0.4, -1.9, -0.5], scale: 0.3, color: "#b3c0c1" },
  { pos: [-0.8, 1.7, -0.8], scale: 0.24, color: "#8fa0a3" },
  { pos: [1.3, -1.3, 1.1], scale: 0.2, color: "#aab7ba" },
]

const SPIKES: { pos: [number, number, number]; rot: [number, number, number]; scale: number }[] = [
  { pos: [2.1, 0.2, -0.3], rot: [0, 0, -Math.PI / 2], scale: 1 },
  { pos: [-2.0, 0.4, 0.2], rot: [0, 0, Math.PI / 2], scale: 0.9 },
  { pos: [0.2, 2.1, 0.1], rot: [0, 0, 0], scale: 0.8 },
  { pos: [-0.3, -2.0, 0.3], rot: [Math.PI, 0, 0], scale: 0.85 },
  { pos: [1.2, 1.4, -1.0], rot: [0, 0, -Math.PI / 3], scale: 0.7 },
]

/** Procedural studio: green and blue light bars reflected by the chrome. */
function MetalEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#05080a"]} />
      {/* Key white sweep */}
      <Lightformer intensity={2.6} position={[0, 3, 2]} scale={[8, 1.5, 1]} />
      {/* Green tube — the signature metalheart cast */}
      <Lightformer intensity={3.2} color="#2bf0c0" position={[-4, 1, 1]} scale={[1, 6, 1]} />
      <Lightformer intensity={2.4} color="#19b792" position={[-2, -3, 2]} scale={[5, 1, 1]} />
      {/* Cold blue reflections */}
      <Lightformer intensity={3.0} color="#4f93f5" position={[4, 0, 1]} scale={[1, 6, 1]} />
      <Lightformer intensity={1.8} color="#88bcff" position={[2, 3, -1]} scale={[4, 1, 1]} />
      {/* Dim fill from below */}
      <Lightformer intensity={0.8} color="#20343f" position={[0, -4, -2]} scale={[8, 3, 1]} />
    </Environment>
  )
}

function Rig() {
  const { camera } = useThree()
  useFrame((_, delta) => {
    // Gentle parallax: camera eases toward the pointer for depth
    const tx = pointer.x * 0.5
    const ty = -pointer.y * 0.4
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, tx, 1 - Math.pow(0.01, delta))
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, ty, 1 - Math.pow(0.01, delta))
    camera.lookAt(0, 0, 0)
  })
  return null
}

export default function ChromeArtifact() {
  usePointerTracking()
  const reducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

  return (
    <Canvas
      className="!pointer-events-none"
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ position: [0, 0, 6.5], fov: 42 }}
    >
      <ambientLight intensity={0.25} />
      <pointLight position={[5, 5, 5]} intensity={40} color="#88bcff" />
      <pointLight position={[-6, -2, 2]} intensity={30} color="#2bf0c0" />
      <MetalCluster reducedMotion={!!reducedMotion} />
      <MetalEnvironment />
      <Rig />
    </Canvas>
  )
}
