import { describe, expect, it } from 'vitest'
import { keyName } from '../theory/keys'
import { keyIdLevelById, KEY_ID_LEVELS } from './presets'
import { consistentAnswers, KeyIdGenerator } from './questions'
import {
  DEFAULT_KEY_ID_SETTINGS,
  mergeKeyIdSettings,
  parseKeyIdSettings,
  toQuestionConfig,
  toSessionSettings,
} from './settings'

const errorsFor = (input: unknown): string[] => {
  const r = parseKeyIdSettings(input)
  if (r.ok) throw new Error('expected errors')
  return r.errors
}

describe('key-ID settings', () => {
  it('accept the defaults and an empty object, filling everything from the defaults', () => {
    expect(parseKeyIdSettings({})).toMatchObject({ ok: true, settings: DEFAULT_KEY_ID_SETTINGS })
    expect(parseKeyIdSettings(DEFAULT_KEY_ID_SETTINGS).ok).toBe(true)
  })

  it('survive a trip through JSON text', () => {
    const r = parseKeyIdSettings({
      modes: 'both',
      goal: { medianSeconds: 3, accuracy: 0.9, reps: 10 },
    })
    if (!r.ok) throw new Error('should be valid')
    expect(parseKeyIdSettings(JSON.parse(JSON.stringify(r.settings)))).toEqual(r)
  })

  it.each([
    [{ name: '' }, /^name: must be 1 to 60 characters/],
    [{ maxAccidentals: 8 }, /^maxAccidentals: must be a whole number from 0 to 7 \(got 8\)/],
    [{ modes: 'dorian' }, /^modes: must be "major", "minor" or "both"/],
    [
      { timeoutSeconds: 0 },
      /^timeoutSeconds: must be null \(no timeout\) or a number from 1 to 120/,
    ],
    [{ questions: 0 }, /^questions: must be a whole number from 1 to 200/],
    [
      { goal: { medianSeconds: 0, accuracy: 2, reps: 0 } },
      /goal.medianSeconds: must be a number above 0/,
    ],
  ])('reject %j with a message naming the field', (input, pattern) => {
    expect(errorsFor(input).some((e) => pattern.test(e))).toBe(true)
  })

  it('ignore settings that no longer exist (question type, clef, enharmonic, answer method) with a warning', () => {
    const r = parseKeyIdSettings({
      format: 'pair',
      clefs: ['bass'],
      enharmonic: 'lenient',
      answerMethod: 'play',
    })
    expect(r.ok && r.warnings.map((w) => w.split(':')[0]).sort()).toEqual([
      'answerMethod',
      'clefs',
      'enharmonic',
      'format',
    ])
    expect(r.ok && Object.keys(r.settings)).not.toContain('clefs')
  })

  it('report every problem at once, warn about unknown settings, and refuse a newer version', () => {
    expect(errorsFor({ name: '', modes: 'x', maxAccidentals: 99 }).length).toBeGreaterThanOrEqual(3)
    const r = parseKeyIdSettings({ flavour: 'spicy' })
    expect(r.ok && r.warnings).toEqual(['flavour: unknown setting, ignored'])
    expect(errorsFor({ version: 2 })[0]).toMatch(/not understood by this app/)
    expect(errorsFor('hello')).toEqual(['settings: must be a JSON object'])
  })

  it('merge custom options onto a base level without changing it', () => {
    const base = parseKeyIdSettings({ modes: 'major', maxAccidentals: 2 })
    if (!base.ok) throw new Error('valid')
    const merged = mergeKeyIdSettings(base.settings, { maxAccidentals: 5, modes: 'both' })
    expect(merged.ok && merged.settings).toMatchObject({ maxAccidentals: 5, modes: 'both' })
    expect(base.settings.maxAccidentals).toBe(2)
    expect(mergeKeyIdSettings(base.settings, { maxAccidentals: 12 }).ok).toBe(false)
  })

  it('turn into the generator and session settings', () => {
    const s = parseKeyIdSettings({ modes: 'minor', maxAccidentals: 3, timeoutSeconds: null })
    if (!s.ok) throw new Error('valid')
    expect(toQuestionConfig(s.settings)).toEqual({ maxAccidentals: 3, modes: 'minor' })
    expect(toSessionSettings(s.settings)).toEqual({ timeoutSeconds: null })
  })
})

describe('the key-ID preset levels', () => {
  it('there are 5, numbered 1 to 5, each valid with no warnings and with a goal', () => {
    expect(KEY_ID_LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5])
    for (const l of KEY_ID_LEVELS) {
      const r = parseKeyIdSettings(l.settings)
      expect(r.ok && r.warnings).toEqual([])
      expect(l.settings.goal).toBeDefined()
    }
  })

  it('go from a few major keys, to all major keys, then major and minor, up to all 30 keys', () => {
    expect(KEY_ID_LEVELS.map((l) => l.settings.modes)).toEqual([
      'major',
      'major',
      'major',
      'both',
      'both',
    ])
    expect(KEY_ID_LEVELS.map((l) => l.settings.maxAccidentals)).toEqual([2, 4, 7, 4, 7])
    const goals = KEY_ID_LEVELS.map((l) => l.settings.goal!.medianSeconds)
    for (let i = 1; i < goals.length; i++) expect(goals[i]).toBeGreaterThanOrEqual(goals[i - 1])
  })

  it('every level makes valid questions, each with exactly one right answer', () => {
    for (const l of KEY_ID_LEVELS) {
      const g = new KeyIdGenerator(toQuestionConfig(l.settings), 3)
      for (let i = 0; i < 300; i++) expect(consistentAnswers(g.next()), l.name).toHaveLength(1)
    }
  })

  it('level 5 reaches all 30 keys and level 1 only the major keys up to 2 accidentals', () => {
    const keys = (id: number) => {
      const g = new KeyIdGenerator(toQuestionConfig(keyIdLevelById(id).settings), 5)
      return new Set(Array.from({ length: 3000 }, () => keyName(g.next().key)))
    }
    expect(keys(5).size).toBe(30)
    expect([...keys(1)].sort()).toEqual(['B♭ major', 'C major', 'D major', 'F major', 'G major'])
  })

  it('throws for a level that does not exist', () => {
    expect(() => keyIdLevelById(6)).toThrow(RangeError)
  })
})
