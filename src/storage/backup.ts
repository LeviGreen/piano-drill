import { isObject } from '../levels/settings'
import type { Storage } from './repositories'
import type { PresetRecord, ScoreRecord, SessionRecord, SettingRecord, StoredRep } from './types'

/** Version of the backup file format. Bump it when the shape of a backup changes. */
export const BACKUP_VERSION = 1

/** Everything saved, as one JSON-able object: the export file (design §8.4). */
export type Backup = {
  app: 'piano-drill'
  backupVersion: number
  exportedAt: string
  sessions: SessionRecord[]
  /** Reps without their database ids (they are linked to a session by `sessionId`). */
  reps: Omit<StoredRep, 'id'>[]
  presets: PresetRecord[]
  settings: SettingRecord[]
  /** High-score boards. Backups made before they existed have none. */
  scores?: ScoreRecord[]
}

export type BackupParse = { ok: true; backup: Backup } | { ok: false; errors: string[] }

const isStr = (v: unknown): v is string => typeof v === 'string' && v !== ''
const MODES = ['play', 'keyid']

/** Check that some JSON is a backup this version of the app can read, with errors that say what is wrong. */
export function parseBackup(input: unknown): BackupParse {
  if (!isObject(input) || input.app !== 'piano-drill')
    return { ok: false, errors: ['file: this is not a Piano Drill backup'] }
  if (!Number.isInteger(input.backupVersion) || (input.backupVersion as number) < 1)
    return { ok: false, errors: ['backupVersion: missing or not a whole number'] }
  if ((input.backupVersion as number) > BACKUP_VERSION)
    return {
      ok: false,
      errors: [
        `backupVersion: ${input.backupVersion} is newer than this app understands (it knows up to ${BACKUP_VERSION}). Update the app and try again.`,
      ],
    }
  const errors: string[] = []
  for (const key of ['sessions', 'reps', 'presets', 'settings'] as const)
    if (!Array.isArray(input[key])) errors.push(`${key}: must be a list`)
  if (errors.length > 0) return { ok: false, errors }

  const check = (list: unknown[], name: string, ok: (x: Record<string, unknown>) => boolean) =>
    list.forEach((x, i) => {
      if (!isObject(x) || !ok(x))
        errors.push(`${name}[${i}]: not a valid ${name.replace(/s$/, '')}`)
    })
  check(
    input.sessions as unknown[],
    'sessions',
    (s) => isStr(s.id) && MODES.includes(s.mode as string) && isStr(s.level) && isStr(s.startedAt),
  )
  check(
    input.reps as unknown[],
    'reps',
    (r) =>
      isStr(r.sessionId) &&
      MODES.includes(r.mode as string) &&
      isStr(r.timestamp) &&
      isStr(r.outcome),
  )
  check(
    input.presets as unknown[],
    'presets',
    (p) => isStr(p.id) && MODES.includes(p.mode as string) && isStr(p.name),
  )
  check(input.settings as unknown[], 'settings', (s) => isStr(s.key))
  if (input.scores !== undefined) {
    if (!Array.isArray(input.scores)) errors.push('scores: must be a list')
    else
      check(
        input.scores,
        'scores',
        (s) =>
          isStr(s.id) &&
          MODES.includes(s.mode as string) &&
          isStr(s.level) &&
          isStr(s.initials) &&
          typeof s.score === 'number',
      )
  }
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 10) }
  return { ok: true, backup: input as unknown as Backup }
}

/** Read everything out. */
export async function exportBackup(storage: Storage): Promise<Backup> {
  const { db } = storage
  const [sessions, reps, presets, settings, scores] = await Promise.all([
    db.sessions.toArray(),
    db.reps.orderBy('id').toArray(),
    db.presets.toArray(),
    db.settings.toArray(),
    db.scores.toArray(),
  ])
  return {
    app: 'piano-drill',
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    sessions,
    reps: reps.map(({ id: _id, ...rest }) => rest),
    presets,
    settings,
    scores,
  }
}

/** Keep each board to its top scores (a merged backup can add more than fit). */
async function trimBoards(storage: Storage): Promise<void> {
  const { db } = storage
  const all = await db.scores.toArray()
  const keys = new Set(all.map((s) => `${s.mode}|${s.level}`))
  for (const key of keys) {
    const [mode, level] = key.split('|')
    const board = await storage.topScores(mode as ScoreRecord['mode'], level)
    const keep = new Set(board.map((s) => s.id))
    const drop = all.filter((s) => s.mode === mode && s.level === level && !keep.has(s.id))
    if (drop.length > 0) await db.scores.bulkDelete(drop.map((s) => s.id))
  }
}

export type ImportMode =
  /** Wipe what is saved and put the backup in its place. */
  | 'replace'
  /** Keep what is saved and add what the backup has that is missing (on a clash, what is saved wins). */
  | 'merge'

/** Put a backup (already checked with `parseBackup`) into storage. All or nothing. */
export async function importBackup(
  storage: Storage,
  backup: Backup,
  mode: ImportMode = 'replace',
): Promise<{ sessions: number; reps: number; presets: number; settings: number; scores: number }> {
  const { db } = storage
  return db.transaction(
    'rw',
    [db.sessions, db.reps, db.presets, db.settings, db.scores],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.sessions.clear(),
          db.reps.clear(),
          db.presets.clear(),
          db.settings.clear(),
          db.scores.clear(),
        ])
      }
      const haveSessions = new Set(
        mode === 'merge' ? await db.sessions.toCollection().primaryKeys() : [],
      )
      const havePresets = new Set(
        mode === 'merge' ? await db.presets.toCollection().primaryKeys() : [],
      )
      const haveScores = new Set(
        mode === 'merge' ? await db.scores.toCollection().primaryKeys() : [],
      )
      const haveSettings = new Set(
        mode === 'merge' ? await db.settings.toCollection().primaryKeys() : [],
      )
      const sessions = backup.sessions.filter((s) => !haveSessions.has(s.id))
      const added = new Set(sessions.map((s) => s.id))
      const reps = backup.reps.filter((r) => added.has(r.sessionId))
      const presets = backup.presets.filter((p) => !havePresets.has(p.id))
      const settings = backup.settings.filter((s) => !haveSettings.has(s.key))
      await db.sessions.bulkAdd(sessions)
      await db.reps.bulkAdd(reps)
      await db.presets.bulkAdd(presets)
      await db.settings.bulkAdd(settings)
      const scores = (backup.scores ?? []).filter((s) => !haveScores.has(s.id))
      await db.scores.bulkAdd(scores)
      await trimBoards(storage)
      return {
        sessions: sessions.length,
        reps: reps.length,
        presets: presets.length,
        settings: settings.length,
        scores: scores.length,
      }
    },
  )
}
