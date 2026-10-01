"use client"

import { EmblemScene } from "./emblem"
import { RailScene } from "./rail"
import { ShardsScene } from "./shards"
import { SpheresScene } from "./spheres"
import type { MetalSceneProps } from "./types"
import { UrchinScene } from "./urchin"

/** Lazy-loaded entry point for every WebGL metal piece (see metal-canvas). */
export default function MetalScene(props: MetalSceneProps) {
  switch (props.scene) {
    case "urchin":
      return <UrchinScene {...props} />
    case "emblem":
      return <EmblemScene {...props} />
    case "spheres":
      return <SpheresScene {...props} />
    case "rail":
      return <RailScene {...props} />
    case "shards":
      return <ShardsScene {...props} />
  }
}
