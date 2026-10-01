export type RailLayout = "band" | "left" | "right"
export type ShardLayout = "sides" | "burst"

/** Which metal piece to render, plus its per-piece options. */
export type MetalSceneOptions =
  | { scene: "urchin" }
  | { scene: "emblem" }
  | { scene: "spheres" }
  | { scene: "rail"; layout: RailLayout }
  | { scene: "shards"; layout: ShardLayout }

export type MetalSceneProps = MetalSceneOptions & {
  /** Render continuously (on screen) or freeze the last frame */
  active: boolean
  reducedMotion: boolean
}
