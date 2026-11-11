/** A random source returning floats in [0, 1). Injectable so tests and replays are deterministic. */
export type Rng = () => number

/** Small seeded PRNG (mulberry32). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Uniform integer in 0..n-1. */
export const randInt = (rng: Rng, n: number): number => Math.floor(rng() * n)

export const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[randInt(rng, xs.length)]

/** A shuffled copy (Fisher-Yates). */
export function shuffled<T>(rng: Rng, xs: readonly T[]): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
