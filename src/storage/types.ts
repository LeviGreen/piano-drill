import type { RepResult } from '../session/types'

export type StoredMode = 'play' | 'keyid'

/** One practice session: what was practised, with what settings, and how far it got. Its reps are stored beside it. */
export type SessionRecord = {
  id: string
  mode: StoredMode
  /** The preset level it was played at ("1" to "10"), or "custom". Sessions are compared within one level. */
  level: string
  levelName: string
  /** The settings in force (plain JSON, as the level settings are), kept so a result can be understood later. */
  settings: unknown
  startedAt: string
  endedAt: string | null
  plannedReps: number
  completedReps: number
}

/** A rep result as stored: the session's reps share its id. `id` is assigned by the database. */
export type StoredRep = RepResult & { id?: number }

/** A saved custom setup for a mode. */
export type PresetRecord = {
  id: string
  mode: StoredMode
  name: string
  settings: unknown
  createdAt: string
  updatedAt: string
}

/** A remembered setting, such as the last level or a display option. */
export type SettingRecord = { key: string; value: unknown }
