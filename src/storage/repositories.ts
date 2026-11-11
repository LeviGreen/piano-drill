import type { RepResult } from '../session/types'
import type { PianoDrillDB } from './db'
import type { PresetRecord, SessionRecord, SettingRecord, StoredMode, StoredRep } from './types'

export type SessionQuery = { mode?: StoredMode; level?: string; limit?: number }

/**
 * Everything the app saves, behind one object: sessions with their rep results, custom presets, and remembered
 * settings. Screens use this and never touch the database directly.
 */
export class Storage {
  readonly db: PianoDrillDB

  constructor(db: PianoDrillDB) {
    this.db = db
  }

  // ---------- sessions and reps ----------

  /** Save a session and all its reps together: both are stored or neither is. Saving the same id again replaces it. */
  async saveSession(session: SessionRecord, reps: RepResult[]): Promise<void> {
    await this.db.transaction('rw', this.db.sessions, this.db.reps, async () => {
      await this.db.reps.where('sessionId').equals(session.id).delete()
      await this.db.sessions.put(session)
      await this.db.reps.bulkAdd(reps.map((r) => ({ ...r, sessionId: session.id })))
    })
  }

  getSession(id: string): Promise<SessionRecord | undefined> {
    return this.db.sessions.get(id)
  }

  /** Sessions, newest first, optionally of one mode and level. */
  async listSessions(query: SessionQuery = {}): Promise<SessionRecord[]> {
    let rows: SessionRecord[]
    if (query.mode && query.level !== undefined) {
      rows = await this.db.sessions
        .where('[mode+level]')
        .equals([query.mode, query.level])
        .toArray()
    } else if (query.mode) {
      rows = await this.db.sessions.where('mode').equals(query.mode).toArray()
    } else {
      rows = await this.db.sessions.toArray()
    }
    if (!query.mode && query.level !== undefined) rows = rows.filter((s) => s.level === query.level)
    rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    return query.limit === undefined ? rows : rows.slice(0, query.limit)
  }

  /** The most recent session at a level other than `excludeId`, for "compared with last time". */
  async previousSession(
    mode: StoredMode,
    level: string,
    excludeId?: string,
  ): Promise<SessionRecord | undefined> {
    return (await this.listSessions({ mode, level })).find((s) => s.id !== excludeId)
  }

  /** The reps of a session, in the order they were played. */
  async getReps(sessionId: string): Promise<StoredRep[]> {
    return this.db.reps.where('sessionId').equals(sessionId).sortBy('id')
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.sessions, this.db.reps, async () => {
      await this.db.reps.where('sessionId').equals(id).delete()
      await this.db.sessions.delete(id)
    })
  }

  // ---------- custom presets ----------

  /** Create a preset or, with an existing id, update it (keeping when it was first made). */
  async savePreset(
    preset: Omit<PresetRecord, 'createdAt' | 'updatedAt'> & { createdAt?: string },
  ): Promise<PresetRecord> {
    const now = new Date().toISOString()
    const existing = await this.db.presets.get(preset.id)
    const saved: PresetRecord = {
      ...preset,
      createdAt: existing?.createdAt ?? preset.createdAt ?? now,
      updatedAt: now,
    }
    await this.db.presets.put(saved)
    return saved
  }

  getPreset(id: string): Promise<PresetRecord | undefined> {
    return this.db.presets.get(id)
  }

  /** Presets of a mode, by name. */
  async listPresets(mode: StoredMode): Promise<PresetRecord[]> {
    const rows = await this.db.presets.where('mode').equals(mode).toArray()
    return rows.sort((a, b) => a.name.localeCompare(b.name))
  }

  deletePreset(id: string): Promise<void> {
    return this.db.presets.delete(id)
  }

  // ---------- remembered settings ----------

  async getSetting<T = unknown>(key: string): Promise<T | undefined> {
    return (await this.db.settings.get(key))?.value as T | undefined
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    const row: SettingRecord = { key, value }
    await this.db.settings.put(row)
  }

  deleteSetting(key: string): Promise<void> {
    return this.db.settings.delete(key)
  }

  // ---------- everything ----------

  /** Delete all saved data. */
  async wipe(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.sessions, this.db.reps, this.db.presets, this.db.settings],
      async () => {
        await Promise.all([
          this.db.sessions.clear(),
          this.db.reps.clear(),
          this.db.presets.clear(),
          this.db.settings.clear(),
        ])
      },
    )
  }
}
