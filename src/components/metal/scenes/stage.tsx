"use client"

import { useEffect, useRef, type ReactNode } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree, type CanvasProps } from "@react-three/fiber"
import { Environment, Lightformer } from "@react-three/drei"

import { pointer, retainPointer } from "../pointer"
import { damp, useDisposable } from "./kit"

/* Linear-space studio gradient: dim steel sky, a bright band just above the
   horizon, then a near-black floor. Symmetric around Y, so it reads the
   same however far the shimmer has rotated the studio. */
const SKY_SHADER = {
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      float y = vDir.y;
      vec3 zenith = vec3(0.022, 0.027, 0.032);
      vec3 sky = vec3(0.075, 0.09, 0.105);
      vec3 horizon = vec3(0.16, 0.185, 0.2);
      vec3 floorNear = vec3(0.012, 0.014, 0.016);
      vec3 floorFar = vec3(0.003, 0.0035, 0.004);
      vec3 c = y > 0.0
        ? mix(mix(horizon, sky, smoothstep(0.0, 0.18, y)), zenith, smoothstep(0.18, 0.95, y))
        : mix(floorNear, floorFar, smoothstep(0.0, -0.5, y));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
}

function SkyDome() {
  const geometry = useDisposable(() => new THREE.SphereGeometry(40, 48, 24))
  const material = useDisposable(
    () => new THREE.ShaderMaterial({ ...SKY_SHADER, side: THREE.BackSide, depthWrite: false })
  )
  return <mesh geometry={geometry} material={material} renderOrder={-1} />
}

/**
 * Procedural gunmetal studio (no HDRI download): a gradient dome with a
 * hard chrome horizon, steel strip lights and thin green/blue tubes.
 * Everything metal in the scenes is lit only by reflecting this.
 */
function GunmetalStudio() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#090c0e"]} />
      <SkyDome />
      {/* Overhead softbox and the bright horizon line */}
      <Lightformer intensity={1.5} position={[0, 7, 0]} scale={[12, 12, 1]} />
      <Lightformer intensity={4.2} position={[0, 0.5, -7]} scale={[34, 0.55, 1]} />
      <Lightformer intensity={1.3} position={[0, -0.3, 7]} scale={[34, 0.35, 1]} />
      {/* Steel strips */}
      <Lightformer intensity={2.4} position={[-7, 1, -1]} scale={[0.9, 14, 1]} />
      <Lightformer intensity={1.5} position={[7, 0, -2.5]} scale={[0.5, 14, 1]} />
      <Lightformer intensity={1.1} position={[2.5, 2, -6]} scale={[0.3, 9, 1]} />
      {/* Green and blue tinges */}
      <Lightformer intensity={3} color="#1fe0b0" position={[-5, -0.5, 4.5]} scale={[0.6, 10, 1]} />
      <Lightformer intensity={3.2} color="#4f93f5" position={[5.5, -0.5, 3.5]} scale={[0.6, 10, 1]} />
      <Lightformer form="ring" intensity={2.4} color="#bfe0ff" position={[3, 4.5, 3]} scale={2.2} />
      {/* Dim floor so downward faces read as dark gunmetal */}
      <Lightformer intensity={0.3} color="#2a3740" position={[0, -7, 0]} scale={[16, 16, 1]} />
    </Environment>
  )
}

/** Rotates the reflected studio with time and the pointer — the shimmer
    that runs across every surface, rotating or not. */
function Shimmer({ offset }: { offset: number }) {
  const scene = useThree((s) => s.scene)
  const state = useRef({ t: offset, x: 0, y: 0 })
  useFrame((_, delta) => {
    const s = state.current
    const dt = Math.min(delta, 0.05)
    s.t += dt
    const k = damp(2.5, dt)
    s.x += (pointer.nx - s.x) * k
    s.y += (pointer.ny - s.y) * k
    scene.environmentRotation.set(s.y * 0.4 + Math.sin(s.t * 0.21) * 0.08, s.t * 0.11 + s.x * 1.1, 0)
  })
  return null
}

/** With frameloop "demand", nudge a few renders so the environment lands. */
function SettleFrames() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    invalidate()
    const timers = [80, 300].map((ms) => setTimeout(() => invalidate(), ms))
    return () => timers.forEach(clearTimeout)
  }, [invalidate])
  return null
}

export function Stage({
  children,
  active,
  reducedMotion,
  camera,
  orthographic,
  dpr = [1, 1.75],
  shimmerOffset = 0,
}: {
  children: ReactNode
  active: boolean
  reducedMotion: boolean
  camera?: CanvasProps["camera"]
  orthographic?: boolean
  dpr?: CanvasProps["dpr"]
  shimmerOffset?: number
}) {
  useEffect(() => retainPointer(), [])

  return (
    <Canvas
      dpr={dpr}
      orthographic={orthographic}
      camera={camera}
      frameloop={reducedMotion ? "demand" : active ? "always" : "never"}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ pointerEvents: "none" }}
    >
      <GunmetalStudio />
      {reducedMotion ? <SettleFrames /> : <Shimmer offset={shimmerOffset} />}
      {children}
    </Canvas>
  )
}
