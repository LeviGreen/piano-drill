/** Small helpers for checking and merging settings that arrive as plain JSON. */

export type Json = Record<string, unknown>

export const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** A value written the way it would appear in a message: strings quoted, everything else as JSON. */
export const show = (v: unknown): string =>
  typeof v === 'string' ? `"${v}"` : (JSON.stringify(v) ?? String(v))

export const isInt = (v: unknown, lo: number, hi: number): v is number =>
  Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi

/** Merge `over` onto `base`: objects merge key by key, arrays and values replace. */
export function deepMerge(base: unknown, over: unknown): unknown {
  if (over === undefined) return base
  if (isObject(base) && isObject(over)) {
    const out: Json = { ...base }
    for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k])
    return out
  }
  return over
}
