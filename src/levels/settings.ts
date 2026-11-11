import { DEFAULT_CONSTRAINTS } from '../theory/constraints'
import { findKey, type KeySignature, type Mode } from '../theory/keys'
import { parsePitch } from '../theory/pitch'

/**
 * Difficulty settings for a level (design §3) as plain, JSON-serialisable data. Levels are data, not code,
 * so they can be tuned without a release; this module validates, defaults, merges and migrates them.
 */
export const SETTINGS_VERSION = 2

export type HandMode = 'LH' | 'RH' | 'both'
export type DifficultySettings = {
  version: number
  name: string
  /** Which hands play; several = one is picked at random per target. 'both' = both hands together. */
  hands: HandMode[]
  /**
   * Notes per hand: 1 = note, 2 = interval, 3 = triad, 4 = seventh chord. Used the same way for one hand and
   * for both hands (where each hand gets a count from this list and together they form one chord).
   */
  notesPerHand: number[]
  keys: {
    maxAccidentals: number
    modes: 'major' | 'minor' | 'both'
    /** An explicit key set (e.g. ["C major", "Eb major"]); when given it replaces maxAccidentals and modes. */
    explicit?: string[]
  }
  /** Diatonic interval sizes for 2-note content (2 = second ... 8 = octave). */
  intervalSizes: number[]
  inversions: boolean
  /** Chromatic notes beyond the key signature. */
  chromaticNotes: 'off' | 'occasional'
  /** Ledger lines allowed above and below the staff. */
  ledgerLines: number
  /** Playable range as note names (MVP: G2 to F5). */
  range: { low: string; high: string }
  /** Seconds before a target times out, or null for no timeout. */
  timeoutSeconds: number | null
  octaveStrictness: 'exact' | 'any'
  /** Target for unlocking the next level (design §3.2). */
  goal?: { medianSeconds: number; accuracy: number; reps: number }
}

export const DEFAULT_SETTINGS: DifficultySettings = {
  version: SETTINGS_VERSION,
  name: 'Custom',
  hands: ['RH'],
  notesPerHand: [1],
  keys: { maxAccidentals: 0, modes: 'major' },
  intervalSizes: [2, 3, 4, 5, 6, 7, 8],
  inversions: false,
  chromaticNotes: 'off',
  ledgerLines: 1,
  range: { low: 'G2', high: 'F5' },
  timeoutSeconds: 10,
  octaveStrictness: 'exact',
}

export type ParseResult =
  { ok: true; settings: DifficultySettings; warnings: string[] } | { ok: false; errors: string[] }

// ---------- helpers ----------

export type Json = Record<string, unknown>
export const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
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

// ---------- migration ----------

/**
 * Old settings are upgraded step by step to the current version. Version 0 is the shape used before
 * settings were versioned: a single `hand`, a `noteCount`, `accidentals`, `inversion` and `timeout`.
 */
const LEGACY_KEYS = ['hand', 'noteCount', 'accidentals', 'inversion', 'timeout']

const MIGRATIONS: Record<number, (old: Json) => Json> = {
  // Version 1 had a separate `twoHand` block (voicings, chord sizes, per-hand note counts). Two hands now use the
  // same notesPerHand as one hand, and voicings are chosen automatically.
  1: (old) => {
    const { twoHand, ...rest } = old
    const out: Json = { ...rest, version: 2 }
    const hands = Array.isArray(old.hands) ? old.hands : []
    if (isObject(twoHand) && hands.length === 1 && hands[0] === 'both') {
      const counts = [
        ...(Array.isArray(twoHand.lhNotes) ? twoHand.lhNotes : []),
        ...(Array.isArray(twoHand.rhNotes) ? twoHand.rhNotes : []),
      ]
      const usable = [
        ...new Set(counts.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 4)),
      ].sort()
      if (usable.length > 0) out.notesPerHand = usable
    }
    return out
  },
  0: (old) => {
    const hand = old.hand
    const hands =
      hand === 'either'
        ? ['LH', 'RH']
        : hand === 'left' || hand === 'LH'
          ? ['LH']
          : hand === 'both'
            ? ['both']
            : ['RH']
    const counts =
      old.noteCount === undefined
        ? undefined
        : Array.isArray(old.noteCount)
          ? old.noteCount
          : [old.noteCount]
    const out: Json = { version: 1, hands }
    if (counts) out.notesPerHand = counts
    if (old.name !== undefined) out.name = old.name
    if (old.accidentals !== undefined) out.keys = { maxAccidentals: old.accidentals }
    if (old.inversion !== undefined) out.inversions = old.inversion
    if (old.timeout !== undefined) out.timeoutSeconds = old.timeout === 0 ? null : old.timeout
    return out
  },
}

export function migrateSettings(input: Json): { settings: Json } | { error: string } {
  let current = input
  // No version number: legacy only if it has legacy-shaped fields; otherwise it is a sparse current-format file.
  const looksLegacy = LEGACY_KEYS.some((k) => k in input)
  let version = input.version === undefined ? (looksLegacy ? 0 : SETTINGS_VERSION) : input.version
  if (!Number.isInteger(version))
    return { error: `version: must be a whole number (got ${show(version)})` }
  if ((version as number) > SETTINGS_VERSION) {
    return {
      error: `version: ${version} is newer than this app understands (${SETTINGS_VERSION}); update the app to use these settings`,
    }
  }
  while ((version as number) < SETTINGS_VERSION) {
    const step = MIGRATIONS[version as number]
    if (!step) return { error: `version: no way to upgrade settings from version ${version}` }
    current = step(current)
    version = current.version as number
  }
  return { settings: current }
}

// ---------- validation ----------

const TOP_LEVEL_KEYS = new Set([
  'version',
  'name',
  'hands',
  'notesPerHand',
  'keys',
  'intervalSizes',
  'inversions',
  'chromaticNotes',
  'ledgerLines',
  'range',
  'timeoutSeconds',
  'octaveStrictness',
  'goal',
])

function intList(
  v: unknown,
  path: string,
  lo: number,
  hi: number,
  errors: string[],
  extra?: (n: number) => string | null,
): number[] {
  if (!Array.isArray(v) || v.length === 0) {
    errors.push(`${path}: must be a non-empty list of whole numbers from ${lo} to ${hi}`)
    return []
  }
  v.forEach((n, i) => {
    if (!isInt(n, lo, hi))
      errors.push(`${path}[${i}]: must be a whole number from ${lo} to ${hi} (got ${show(n)})`)
    else {
      const msg = extra?.(n)
      if (msg) errors.push(`${path}[${i}]: ${msg}`)
    }
  })
  return v.filter((n): n is number => isInt(n, lo, hi))
}

function oneOfList<T extends string>(
  v: unknown,
  path: string,
  allowed: readonly T[],
  errors: string[],
): T[] {
  if (!Array.isArray(v) || v.length === 0) {
    errors.push(`${path}: must be a non-empty list of ${allowed.map((a) => `"${a}"`).join(', ')}`)
    return []
  }
  v.forEach((x, i) => {
    if (!allowed.includes(x as T))
      errors.push(
        `${path}[${i}]: ${show(x)} is not one of ${allowed.map((a) => `"${a}"`).join(', ')}`,
      )
  })
  return v.filter((x): x is T => allowed.includes(x as T))
}

/** "C major", "Eb major", "F# minor", "E♭ major" -> the key, or null. */
export function parseKeyName(name: string): KeySignature | null {
  const m = /^([A-G])([#b♯♭]?)\s+(major|minor)$/.exec(name.trim())
  if (!m) return null
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0
  return findKey(m[1] as never, acc, m[3] as Mode)
}

function validate(s: Json): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  for (const k of Object.keys(s))
    if (!TOP_LEVEL_KEYS.has(k)) warnings.push(`${k}: unknown setting, ignored`)

  if (typeof s.name !== 'string' || s.name.trim() === '' || s.name.length > 60) {
    errors.push(`name: must be 1 to 60 characters (got ${show(s.name)})`)
  }
  const hands = oneOfList(s.hands, 'hands', ['LH', 'RH', 'both'] as const, errors)
  if (new Set(hands).size !== hands.length)
    errors.push('hands: must not list the same option twice')
  const singleHand = hands.includes('LH') || hands.includes('RH')

  intList(s.notesPerHand, 'notesPerHand', 1, 5, errors, (n) =>
    n === 5 ? '5 notes per hand (extended chords) is not supported yet; use 1 to 4' : null,
  )

  const keys = s.keys
  if (!isObject(keys)) errors.push('keys: must be an object')
  else {
    if (!isInt(keys.maxAccidentals, 0, 7))
      errors.push(
        `keys.maxAccidentals: must be a whole number from 0 to 7 (got ${show(keys.maxAccidentals)})`,
      )
    if (!['major', 'minor', 'both'].includes(keys.modes as string))
      errors.push(`keys.modes: must be "major", "minor" or "both" (got ${show(keys.modes)})`)
    if (keys.explicit !== undefined) {
      if (!Array.isArray(keys.explicit) || keys.explicit.length === 0)
        errors.push('keys.explicit: must be a non-empty list like ["C major", "A minor"]')
      else
        keys.explicit.forEach((k, i) => {
          if (typeof k !== 'string' || !parseKeyName(k))
            errors.push(
              `keys.explicit[${i}]: ${show(k)} is not a key; write it like "Eb major" or "F# minor"`,
            )
        })
    }
  }

  if (singleHand && Array.isArray(s.notesPerHand) && s.notesPerHand.includes(2)) {
    intList(s.intervalSizes, 'intervalSizes', 2, 9, errors)
  }
  if (typeof s.inversions !== 'boolean')
    errors.push(`inversions: must be true or false (got ${show(s.inversions)})`)
  if (!['off', 'occasional'].includes(s.chromaticNotes as string))
    errors.push(`chromaticNotes: must be "off" or "occasional" (got ${show(s.chromaticNotes)})`)
  if (!isInt(s.ledgerLines, 0, 3))
    errors.push(`ledgerLines: must be a whole number from 0 to 3 (got ${show(s.ledgerLines)})`)

  const range = s.range
  if (!isObject(range)) errors.push('range: must be an object like { "low": "G2", "high": "F5" }')
  else {
    const parse = (k: 'low' | 'high') => {
      try {
        return parsePitch(String(range[k])).midi
      } catch {
        errors.push(`range.${k}: ${show(range[k])} is not a note name like "G2" or "F#5"`)
        return null
      }
    }
    const [lo, hi] = [parse('low'), parse('high')]
    if (lo !== null && hi !== null && lo >= hi)
      errors.push(`range: low (${range.low}) must be below high (${range.high})`)
  }

  const t = s.timeoutSeconds
  if (t !== null && !(typeof t === 'number' && t >= 1 && t <= 120))
    errors.push(
      `timeoutSeconds: must be null (no timeout) or a number from 1 to 120 (got ${show(t)})`,
    )
  if (!['exact', 'any'].includes(s.octaveStrictness as string))
    errors.push(`octaveStrictness: must be "exact" or "any" (got ${show(s.octaveStrictness)})`)

  if (s.goal !== undefined) {
    const g = s.goal
    if (!isObject(g))
      errors.push(
        'goal: must be an object like { "medianSeconds": 2, "accuracy": 0.9, "reps": 20 }',
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
 * Turn any JSON into valid settings: upgrade old versions, fill missing fields from the defaults, then check
 * every field. Problems come back as readable messages naming the field.
 */
export function parseSettings(input: unknown): ParseResult {
  if (!isObject(input)) return { ok: false, errors: ['settings: must be a JSON object'] }
  const migrated = migrateSettings(input)
  if ('error' in migrated) return { ok: false, errors: [migrated.error] }
  const merged = deepMerge(DEFAULT_SETTINGS, migrated.settings) as Json
  const { errors, warnings } = validate(merged)
  if (errors.length > 0) return { ok: false, errors }
  const known: Json = {}
  for (const k of Object.keys(merged)) if (TOP_LEVEL_KEYS.has(k)) known[k] = merged[k]
  return { ok: true, settings: known as unknown as DifficultySettings, warnings }
}

/** A custom preset: a base level with some fields overridden (objects merge, lists and values replace). */
export function mergeSettings(base: DifficultySettings, overrides: unknown): ParseResult {
  if (!isObject(overrides)) return { ok: false, errors: ['overrides: must be a JSON object'] }
  return parseSettings(deepMerge(base, overrides))
}

export function constraintsFor(s: DifficultySettings) {
  return {
    ...DEFAULT_CONSTRAINTS,
    maxLedgerLines: s.ledgerLines,
    lowestMidi: parsePitch(s.range.low).midi,
    highestMidi: parsePitch(s.range.high).midi,
  }
}
