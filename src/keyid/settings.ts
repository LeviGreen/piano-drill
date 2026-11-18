import { isInt, show, type Json } from '../settings/json'
import {
  checkGoal,
  checkName,
  checkTimeout,
  checkVersionOnly,
  createSettings,
  type ParseResult,
} from '../settings/schema'
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

export type KeyIdParseResult = ParseResult<KeyIdSettings>

const KNOWN = new Set([
  'version',
  'name',
  'maxAccidentals',
  'modes',
  'timeoutSeconds',
  'questions',
  'goal',
])

function validate(s: Json): string[] {
  const errors: string[] = []
  checkName(s, errors)
  if (!isInt(s.maxAccidentals, 0, 7))
    errors.push(
      `maxAccidentals: must be a whole number from 0 to 7 (got ${show(s.maxAccidentals)})`,
    )
  if (typeof s.modes !== 'string' || !['major', 'minor', 'both'].includes(s.modes))
    errors.push(`modes: must be "major", "minor" or "both" (got ${show(s.modes)})`)
  checkTimeout(s, errors)
  if (!isInt(s.questions, 1, 200))
    errors.push(`questions: must be a whole number from 1 to 200 (got ${show(s.questions)})`)
  checkGoal(s, '{ "medianSeconds": 3, "accuracy": 0.9, "reps": 10 }', errors)
  return errors
}

const settings = createSettings<KeyIdSettings>({
  knownKeys: KNOWN,
  defaults: DEFAULT_KEY_ID_SETTINGS,
  migrate: checkVersionOnly(KEY_ID_SETTINGS_VERSION),
  validate,
})

/**
 * Turn any JSON into valid key-ID settings: fill missing fields from the defaults, then check every field. Settings
 * saved by earlier versions of the app may carry fields that no longer exist (question type, clef, answer method,
 * enharmonic strictness); they are ignored with a warning.
 */
export const parseKeyIdSettings = settings.parse

/** A custom level: a base level with some fields overridden. */
export const mergeKeyIdSettings = settings.merge

/** What the question generator needs. */
export const toQuestionConfig = (s: KeyIdSettings): KeyIdConfig => ({
  maxAccidentals: s.maxAccidentals,
  modes: s.modes,
})

/** What the session needs. */
export const toSessionSettings = (s: KeyIdSettings): KeyIdSessionSettings => ({
  timeoutSeconds: s.timeoutSeconds,
})
