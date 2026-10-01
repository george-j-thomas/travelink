/** Small deterministic PRNG so generated shapes match on server and client. */
export function seeded(seed: number) {
  let t = seed * 7919 + 13
  return () => {
    t = (t * 9301 + 49297) % 233280
    return t / 233280
  }
}
