"use client"

import { SpikeBall } from "./spike-ball"
import { Stage } from "./stage"
import type { MetalSceneProps } from "./types"

/** Small spinning spike ball for headers and brand lockups. */
export function EmblemScene({ active, reducedMotion }: MetalSceneProps) {
  return (
    <Stage
      active={active}
      reducedMotion={reducedMotion}
      camera={{ position: [0, 0, 6.2], fov: 30 }}
      dpr={[1.5, 2.5]}
      shimmerOffset={3}
    >
      <SpikeBall
        count={22}
        core={0.55}
        length={[0.6, 0.95]}
        width={[0.14, 0.2]}
        seed={9}
        chromeEvery={2}
        longEvery={5}
        spin={0.7}
        reach={0.5}
        still={reducedMotion}
      />
    </Stage>
  )
}
