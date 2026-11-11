import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { RepResult } from '../session/types'
import { exportBackup, importBackup, parseBackup, BACKUP_VERSION } from './backup'
import { PianoDrillDB } from './db'
import { Storage } from './repositories'
import type { SessionRecord } from './types'

let n = 0
let db: PianoDrillDB
let storage: Storage
beforeEach(async () => {
  db = new PianoDrillDB(`test-${++n}`) // a fresh database for every test
  storage = new Storage(db)
})
afterEach(async () => {
  db.close()
  await PianoDrillDB.delete(db.name)
})

const rep = (id: string, over: Partial<RepResult> = {}): RepResult => ({
  sessionId: 'x',
  mode: 'play',
  targetId: id,
  dims: { key: 'C major', noteCount: 1 } as RepResult['dims'],
  reactionMs: 400,
  completionMs: 600,
  errors: [],
  heard: [{ midi: 60, t: 600 }],
  outcome: 'correct',
  startedWithoutSilence: false,
  timestamp: '2026-01-01T10:00:00.000Z',
  ...over,
})
const session = (id: string, over: Partial<SessionRecord> = {}): SessionRecord => ({
  id,
  mode: 'play',
  level: '1',
  levelName: 'Level 1',
  settings: { name: 'Level 1' },
  startedAt: '2026-01-01T10:00:00.000Z',
  endedAt: '2026-01-01T10:05:00.000Z',
  plannedReps: 3,
  completedReps: 3,
  ...over,
})

describe('sessions and reps', () => {
  it('saves a session with its reps, and reads both back in order', async () => {
    await storage.saveSession(session('s1'), [rep('a'), rep('b'), rep('c')])
    expect(await storage.getSession('s1')).toMatchObject({ id: 's1', level: '1' })
    const reps = await storage.getReps('s1')
    expect(reps.map((r) => r.targetId)).toEqual(['a', 'b', 'c'])
    expect(reps.every((r) => r.sessionId === 's1')).toBe(true) // the session id wins over whatever the rep said
  })

  it('keeps every field of a rep, including key-ID detail', async () => {
    const r = rep('k', {
      mode: 'keyid',
      outcome: 'incorrect',
      completionMs: null,
      keyId: {
        format: 'major',
        correct: { accidentals: 2, mode: 'major' },
        given: { accidentals: 3, mode: 'major' },
        method: 'tap',
      },
    })
    await storage.saveSession(session('s1', { mode: 'keyid' }), [r])
    const [back] = await storage.getReps('s1')
    expect(back).toMatchObject({ outcome: 'incorrect', completionMs: null, keyId: r.keyId })
  })

  it('saving a session again replaces it and its reps instead of doubling them', async () => {
    await storage.saveSession(session('s1'), [rep('a'), rep('b')])
    await storage.saveSession(session('s1', { completedReps: 1 }), [rep('z')])
    expect((await storage.getSession('s1'))?.completedReps).toBe(1)
    expect((await storage.getReps('s1')).map((r) => r.targetId)).toEqual(['z'])
  })

  it('lists newest first, and filters by mode and level, with a limit', async () => {
    await storage.saveSession(session('a', { startedAt: '2026-01-01T10:00:00Z' }), [])
    await storage.saveSession(session('b', { startedAt: '2026-01-03T10:00:00Z', level: '2' }), [])
    await storage.saveSession(
      session('c', { startedAt: '2026-01-02T10:00:00Z', mode: 'keyid', level: '1' }),
      [],
    )
    await storage.saveSession(session('d', { startedAt: '2026-01-04T10:00:00Z' }), [])
    const ids = (q = {}) => storage.listSessions(q).then((r) => r.map((s) => s.id))
    expect(await ids()).toEqual(['d', 'b', 'c', 'a'])
    expect(await ids({ mode: 'play' })).toEqual(['d', 'b', 'a'])
    expect(await ids({ mode: 'play', level: '1' })).toEqual(['d', 'a'])
    expect(await ids({ level: '1' })).toEqual(['d', 'c', 'a'])
    expect(await ids({ limit: 2 })).toEqual(['d', 'b'])
  })

  it('finds the previous session at the same level, for comparison', async () => {
    await storage.saveSession(session('a', { startedAt: '2026-01-01T10:00:00Z' }), [])
    await storage.saveSession(session('b', { startedAt: '2026-01-02T10:00:00Z', level: '2' }), [])
    await storage.saveSession(session('c', { startedAt: '2026-01-03T10:00:00Z' }), [])
    expect((await storage.previousSession('play', '1', 'c'))?.id).toBe('a')
    expect((await storage.previousSession('play', '1'))?.id).toBe('c')
    expect(await storage.previousSession('play', '9')).toBeUndefined()
    expect(await storage.previousSession('keyid', '1')).toBeUndefined()
  })

  it('deletes a session and its reps, and only those', async () => {
    await storage.saveSession(session('a'), [rep('1'), rep('2')])
    await storage.saveSession(session('b'), [rep('3')])
    await storage.deleteSession('a')
    expect(await storage.getSession('a')).toBeUndefined()
    expect(await storage.getReps('a')).toEqual([])
    expect((await storage.getReps('b')).map((r) => r.targetId)).toEqual(['3'])
  })

  it('says nothing is there for an unknown id', async () => {
    expect(await storage.getSession('nope')).toBeUndefined()
    expect(await storage.getReps('nope')).toEqual([])
  })
})

describe('custom presets', () => {
  const preset = (id: string, name: string, mode: 'play' | 'keyid' = 'play') => ({
    id,
    mode,
    name,
    settings: { hands: ['RH'] },
  })

  it('creates, reads, lists by name for the mode, and deletes', async () => {
    await storage.savePreset(preset('p2', 'Zebra'))
    await storage.savePreset(preset('p1', 'apple'))
    await storage.savePreset(preset('p3', 'Key one', 'keyid'))
    expect((await storage.listPresets('play')).map((p) => p.name)).toEqual(['apple', 'Zebra'])
    expect((await storage.listPresets('keyid')).map((p) => p.id)).toEqual(['p3'])
    expect(await storage.getPreset('p1')).toMatchObject({
      name: 'apple',
      settings: { hands: ['RH'] },
    })
    await storage.deletePreset('p1')
    expect(await storage.getPreset('p1')).toBeUndefined()
  })

  it('updating keeps when it was first made and stamps the change', async () => {
    const first = await storage.savePreset({
      ...preset('p1', 'Mine'),
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(first.createdAt).toBe('2026-01-01T00:00:00Z')
    const second = await storage.savePreset({
      ...preset('p1', 'Renamed'),
      createdAt: '2030-01-01T00:00:00Z',
    })
    expect(second.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(second.name).toBe('Renamed')
    expect(second.updatedAt >= first.updatedAt).toBe(true)
    expect(await storage.listPresets('play')).toHaveLength(1)
  })
})

describe('remembered settings', () => {
  it('stores any JSON value, overwrites it, and deletes it', async () => {
    expect(await storage.getSetting('play.level')).toBeUndefined()
    await storage.setSetting('play.level', { levelId: 3, names: true })
    expect(await storage.getSetting('play.level')).toEqual({ levelId: 3, names: true })
    await storage.setSetting('play.level', 'custom')
    expect(await storage.getSetting<string>('play.level')).toBe('custom')
    await storage.deleteSetting('play.level')
    expect(await storage.getSetting('play.level')).toBeUndefined()
  })
})

describe('the database', () => {
  it('keeps its data when it is closed and opened again', async () => {
    await storage.saveSession(session('s1'), [rep('a')])
    db.close()
    db = new PianoDrillDB(db.name)
    storage = new Storage(db)
    expect((await storage.getReps('s1')).map((r) => r.targetId)).toEqual(['a'])
  })

  it('wipe deletes everything', async () => {
    await storage.saveSession(session('s1'), [rep('a')])
    await storage.savePreset({ id: 'p', mode: 'play', name: 'P', settings: {} })
    await storage.setSetting('k', 1)
    await storage.wipe()
    expect(await storage.listSessions()).toEqual([])
    expect(await db.reps.count()).toBe(0)
    expect(await storage.listPresets('play')).toEqual([])
    expect(await storage.getSetting('k')).toBeUndefined()
  })
})

describe('export and import', () => {
  const fill = async (s: Storage) => {
    await s.saveSession(session('s1', { startedAt: '2026-01-01T10:00:00Z' }), [rep('a'), rep('b')])
    await s.saveSession(
      session('s2', { mode: 'keyid', level: '3', startedAt: '2026-01-02T10:00:00Z' }),
      [rep('c', { mode: 'keyid' })],
    )
    await s.savePreset({ id: 'p1', mode: 'play', name: 'Mine', settings: { hands: ['LH'] } })
    await s.setSetting('play.level', 4)
  }
  const snapshot = async (s: Storage) => {
    const b = await exportBackup(s)
    return { ...b, exportedAt: '' }
  }

  it('export, wipe, import restores everything (acceptance)', async () => {
    await fill(storage)
    const before = await snapshot(storage)
    const text = JSON.stringify(await exportBackup(storage)) // through real JSON text, like a saved file
    await storage.wipe()
    expect(await storage.listSessions()).toEqual([])
    const parsed = parseBackup(JSON.parse(text))
    if (!parsed.ok) throw new Error(parsed.errors.join(', '))
    const counts = await importBackup(storage, parsed.backup)
    expect(counts).toEqual({ sessions: 2, reps: 3, presets: 1, settings: 1 })
    expect(await snapshot(storage)).toEqual(before)
    expect((await storage.getReps('s1')).map((r) => r.targetId)).toEqual(['a', 'b'])
  })

  it('a backup says what app and version it is, and has no database ids on reps', async () => {
    await fill(storage)
    const b = await exportBackup(storage)
    expect(b).toMatchObject({ app: 'piano-drill', backupVersion: BACKUP_VERSION })
    expect(b.reps.every((r) => !('id' in r))).toBe(true)
  })

  it('merge keeps what is saved and adds only what is missing; on a clash what is saved wins', async () => {
    await fill(storage)
    const backup = await exportBackup(storage)
    // This app has since lost s2, gained s9, and changed a preset and a setting.
    await storage.deleteSession('s2')
    await storage.saveSession(session('s9', { startedAt: '2026-02-01T10:00:00Z' }), [rep('z')])
    await storage.savePreset({ id: 'p1', mode: 'play', name: 'Changed', settings: {} })
    await storage.setSetting('play.level', 9)

    const counts = await importBackup(storage, backup, 'merge')
    expect(counts).toEqual({ sessions: 1, reps: 1, presets: 0, settings: 0 }) // only s2 was missing
    expect((await storage.listSessions()).map((x) => x.id).sort()).toEqual(['s1', 's2', 's9'])
    expect((await storage.getReps('s1')).map((r) => r.targetId)).toEqual(['a', 'b']) // not doubled
    expect((await storage.getReps('s2')).map((r) => r.targetId)).toEqual(['c'])
    expect((await storage.getPreset('p1'))?.name).toBe('Changed')
    expect(await storage.getSetting('play.level')).toBe(9)
  })

  it('replace throws away what was saved and puts the backup in its place', async () => {
    await fill(storage)
    const backup = await exportBackup(storage)
    await storage.saveSession(session('s9'), [rep('z')])
    await storage.setSetting('play.level', 9)
    await importBackup(storage, backup, 'replace')
    expect((await storage.listSessions()).map((x) => x.id).sort()).toEqual(['s1', 's2'])
    expect(await storage.getReps('s9')).toEqual([])
    expect(await storage.getSetting('play.level')).toBe(4)
  })

  it('importing into an empty app works, and an empty backup empties it', async () => {
    const empty = await exportBackup(storage)
    await fill(storage)
    await importBackup(storage, empty, 'replace')
    expect(await storage.listSessions()).toEqual([])
    expect(await db.reps.count()).toBe(0)
  })
})

describe('reading a backup file', () => {
  const good = () => ({
    app: 'piano-drill',
    backupVersion: 1,
    exportedAt: '2026-01-01T00:00:00Z',
    sessions: [],
    reps: [],
    presets: [],
    settings: [],
  })

  it('accepts a good backup', () => {
    expect(parseBackup(good()).ok).toBe(true)
  })

  it.each([
    ['something else entirely', 'hello', /not a Piano Drill backup/],
    ['another app', { ...good(), app: 'other' }, /not a Piano Drill backup/],
    ['no version', { ...good(), backupVersion: undefined }, /backupVersion: missing/],
    ['a newer version', { ...good(), backupVersion: 99 }, /newer than this app understands/],
    ['a list that is not a list', { ...good(), sessions: {} }, /sessions: must be a list/],
    ['a session with no id', { ...good(), sessions: [{ mode: 'play' }] }, /sessions\[0\]/],
    [
      'a rep with a bad mode',
      { ...good(), reps: [{ sessionId: 'a', mode: 'x', timestamp: 't', outcome: 'correct' }] },
      /reps\[0\]/,
    ],
    ['a setting with no key', { ...good(), settings: [{ value: 1 }] }, /settings\[0\]/],
  ])('refuses %s, saying what is wrong', (_name, input, pattern) => {
    const r = parseBackup(input)
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors.some((e) => pattern.test(e))).toBe(true)
  })
})
