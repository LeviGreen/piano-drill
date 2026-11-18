import { deepMerge, isInt, isObject, show, type Json } from './json'

/**
 * The shared machinery for a mode's settings (Sight-Read and Key Signatures both use it): settings are plain JSON that
 * is upgraded if old, filled from defaults, checked field by field with readable errors, and trimmed to the known keys.
 * A new mode only describes itself with a `SettingsSchema` and gets `parse` and `merge` from `createSettings`.
 */
export type ParseResult<T> =
  { ok: true; settings: T; warnings: string[] } | { ok: false; errors: string[] }

export type SettingsSchema<T> = {
  /** Every key a settings object may have; others are dropped with a warning. */
  knownKeys: ReadonlySet<string>
  /** What a field left out of the input gets. */
  defaults: T
  /**
   * Bring the input up to the current version, or say why that is impossible. Modes with no older formats only check
   * the version.
   */
  migrate: (input: Json) => { settings: Json } | { error: string }
  /** Check the merged settings; return one message per problem, each naming its field. */
  validate: (merged: Json) => string[]
}

export function createSettings<T>(schema: SettingsSchema<T>) {
  function parse(input: unknown): ParseResult<T> {
    if (!isObject(input)) return { ok: false, errors: ['settings: must be a JSON object'] }
    const migrated = schema.migrate(input)
    if ('error' in migrated) return { ok: false, errors: [migrated.error] }
    const merged = deepMerge(schema.defaults, migrated.settings) as Json
    const warnings = Object.keys(merged)
      .filter((k) => !schema.knownKeys.has(k))
      .map((k) => `${k}: unknown setting, ignored`)
    const errors = schema.validate(merged)
    if (errors.length > 0) return { ok: false, errors }
    const known: Json = {}
    for (const k of Object.keys(merged)) if (schema.knownKeys.has(k)) known[k] = merged[k]
    return { ok: true, settings: known as T, warnings }
  }

  /** A custom setup: a base level with some fields overridden (objects merge, lists and values replace). */
  function merge(base: T, overrides: unknown): ParseResult<T> {
    if (!isObject(overrides)) return { ok: false, errors: ['overrides: must be a JSON object'] }
    return parse(deepMerge(base, overrides))
  }

  return { parse, merge }
}

// ---------- checks every mode shares ----------

/** A mode's `migrate` when it has only ever had one format: just make sure the version is one this app knows. */
export function checkVersionOnly(current: number) {
  return (input: Json): { settings: Json } | { error: string } => {
    const v = input.version
    if (v !== undefined && (!Number.isInteger(v) || (v as number) > current))
      return {
        error: `version: ${show(v)} is not understood by this app (it knows up to ${current})`,
      }
    return { settings: input }
  }
}

export function checkName(s: Json, errors: string[]): void {
  if (typeof s.name !== 'string' || s.name.trim() === '' || s.name.length > 60)
    errors.push(`name: must be 1 to 60 characters (got ${show(s.name)})`)
}

export function checkTimeout(s: Json, errors: string[]): void {
  const t = s.timeoutSeconds
  if (t !== null && !(typeof t === 'number' && t >= 1 && t <= 120))
    errors.push(
      `timeoutSeconds: must be null (no timeout) or a number from 1 to 120 (got ${show(t)})`,
    )
}

/** The goal for unlocking the next level; `example` is shown in the message so each mode can show typical numbers. */
export function checkGoal(s: Json, example: string, errors: string[]): void {
  if (s.goal === undefined) return
  const g = s.goal
  if (!isObject(g)) {
    errors.push(`goal: must be an object like ${example}`)
    return
  }
  if (!(typeof g.medianSeconds === 'number' && g.medianSeconds > 0))
    errors.push(`goal.medianSeconds: must be a number above 0 (got ${show(g.medianSeconds)})`)
  if (!(typeof g.accuracy === 'number' && g.accuracy >= 0 && g.accuracy <= 1))
    errors.push(`goal.accuracy: must be between 0 and 1 (got ${show(g.accuracy)})`)
  if (!isInt(g.reps, 1, 1000))
    errors.push(`goal.reps: must be a whole number from 1 to 1000 (got ${show(g.reps)})`)
}
