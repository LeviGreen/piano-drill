import { deepMerge, isInt, isObject, show, type Json } from '../levels/settings'
import type { KeyIdConfig } from './questions'
import type { KeyIdSessionSettings } from './KeyIdSession'

/**
 * Settings for a key-ID level, as plain JSON like the play-mode levels: validated with field-named errors, filled from
 * defaults, mergeable into custom levels, and versioned. Deliberately small: how many keys, which modes, how many
 * questions, how long to answer.
 */
export const KEY_ID_SETTINGS_VERSION = 1

export type KeyIdSettings = {
  version: number
  name: string
  /** Keys come from this many sharps or flats (0 to 7) in these modes. */
  maxAccidentals: number
  modes: 'major' | 'minor' | 'both'
  /** Seconds before a question times out, or null for no timeout. */
  timeoutSeconds: number | null
  /** Questions in one session. */
  questions: number
  /** Target for unlocking the next level. */
  goal?: { medianSeconds: number; accuracy: number; reps: number }
}

export const DEFAULT_KEY_ID_SETTINGS: KeyIdSettings = {
  version: KEY_ID_SETTINGS_VERSION,
  name: 'Custom',
  maxAccidentals: 2,
  modes: 'major',
  timeoutSeconds: 10,
  questions: 20,
}

export type KeyIdParseResult =
  { ok: true; settings: KeyIdSettings; warnings: string[] } | { ok: false; errors: string[] }

const KNOWN = new Set([
  'version',
  'name',
  'maxAccidentals',
  'modes',
  'timeoutSeconds',
  'questions',
  'goal',
])

function validate(s: Json): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  for (const k of Object.keys(s)) if (!KNOWN.has(k)) warnings.push(`${k}: unknown setting, ignored`)
  if (typeof s.name !== 'string' || s.name.trim() === '' || s.name.length > 60)
    errors.push(`name: must be 1 to 60 characters (got ${show(s.name)})`)
  if (!isInt(s.maxAccidentals, 0, 7))
    errors.push(
      `maxAccidentals: must be a whole number from 0 to 7 (got ${show(s.maxAccidentals)})`,
    )
  if (typeof s.modes !== 'string' || !['major', 'minor', 'both'].includes(s.modes))
    errors.push(`modes: must be "major", "minor" or "both" (got ${show(s.modes)})`)
  const t = s.timeoutSeconds
  if (t !== null && !(typeof t === 'number' && t >= 1 && t <= 120))
    errors.push(
      `timeoutSeconds: must be null (no timeout) or a number from 1 to 120 (got ${show(t)})`,
    )
  if (!isInt(s.questions, 1, 200))
    errors.push(`questions: must be a whole number from 1 to 200 (got ${show(s.questions)})`)
  if (s.goal !== undefined) {
    const g = s.goal
    if (!isObject(g))
      errors.push(
        'goal: must be an object like { "medianSeconds": 3, "accuracy": 0.9, "reps": 10 }',
      )
    else {
      if (!(typeof g.medianSeconds === 'number' && g.medianSeconds > 0))
        errors.push(`goal.medianSeconds: must be a number above 0 (got ${show(g.medianSeconds)})`)
      if (!(typeof g.accuracy === 'number' && g.accuracy >= 0 && g.accuracy <= 1))
        errors.push(`goal.accuracy: must be between 0 and 1 (got ${show(g.accuracy)})`)
      if (!isInt(g.reps, 1, 1000))
        errors.push(`goal.reps: must be a whole number from 1 to 1000 (got ${show(g.reps)})`)
    }
  }
  return { errors, warnings }
}

/**
 * Turn any JSON into valid key-ID settings: fill missing fields from the defaults, then check every field. Settings
 * saved by earlier versions of the app may carry fields that no longer exist (question type, clef, answer method,
 * enharmonic strictness); they are ignored with a warning.
 */
export function parseKeyIdSettings(input: unknown): KeyIdParseResult {
  if (!isObject(input)) return { ok: false, errors: ['settings: must be a JSON object'] }
  if (
    input.version !== undefined &&
    (!Number.isInteger(input.version) || (input.version as number) > KEY_ID_SETTINGS_VERSION)
  ) {
    return {
      ok: false,
      errors: [
        `version: ${show(input.version)} is not understood by this app (it knows up to ${KEY_ID_SETTINGS_VERSION})`,
      ],
    }
  }
  const merged = deepMerge(DEFAULT_KEY_ID_SETTINGS, input) as Json
  const { errors, warnings } = validate(merged)
  if (errors.length > 0) return { ok: false, errors }
  const known: Json = {}
  for (const k of Object.keys(merged)) if (KNOWN.has(k)) known[k] = merged[k]
  return { ok: true, settings: known as unknown as KeyIdSettings, warnings }
}

/** A custom level: a base level with some fields overridden. */
export function mergeKeyIdSettings(base: KeyIdSettings, overrides: unknown): KeyIdParseResult {
  if (!isObject(overrides)) return { ok: false, errors: ['overrides: must be a JSON object'] }
  return parseKeyIdSettings(deepMerge(base, overrides))
}

/** What the question generator needs. */
export const toQuestionConfig = (s: KeyIdSettings): KeyIdConfig => ({
  maxAccidentals: s.maxAccidentals,
  modes: s.modes,
})

/** What the session needs. */
export const toSessionSettings = (s: KeyIdSettings): KeyIdSessionSettings => ({
  timeoutSeconds: s.timeoutSeconds,
})
