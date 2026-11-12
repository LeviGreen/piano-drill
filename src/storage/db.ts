import Dexie, { type EntityTable } from 'dexie'
import type { PresetRecord, ScoreRecord, SessionRecord, SettingRecord, StoredRep } from './types'

export const DB_NAME = 'piano-drill'

/**
 * The IndexedDB database (design §8.4). Schema changes go in as a new `version(n)` with an `upgrade` step, never as
 * an edit to an old one, so existing data moves forward instead of being lost.
 */
export class PianoDrillDB extends Dexie {
  sessions!: EntityTable<SessionRecord, 'id'>
  reps!: EntityTable<StoredRep, 'id'>
  presets!: EntityTable<PresetRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>
  scores!: EntityTable<ScoreRecord, 'id'>

  constructor(name = DB_NAME) {
    super(name)
    this.version(1).stores({
      sessions: 'id, mode, startedAt, [mode+level]',
      reps: '++id, sessionId, mode, timestamp',
      presets: 'id, mode, name',
      settings: 'key',
    })
    // Version 2: high-score boards. Tables not listed here carry over unchanged.
    this.version(2).stores({ scores: 'id, [mode+level]' })
  }
}
