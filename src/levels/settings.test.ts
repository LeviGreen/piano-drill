import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  migrateSettings,
  parseKeyName,
  parseSettings,
  SETTINGS_VERSION,
} from './settings'
import { keyName } from '../theory/keys'

const errorsFor = (input: unknown): string[] => {
  const r = parseSettings(input)
  if (r.ok) throw new Error('expected errors')
  return r.errors
}

describe('parseSettings: defaults and valid input', () => {
  it('accepts the defaults and an empty object (everything filled from defaults)', () => {
    const empty = parseSettings({})
    expect(empty.ok && empty.settings).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(DEFAULT_SETTINGS).ok).toBe(true)
  })

  it('fills only the missing fields and keeps what was given', () => {
    const r = parseSettings({ name: 'My drill', hands: ['LH'], keys: { maxAccidentals: 3 } })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.settings.hands).toEqual(['LH'])
      expect(r.settings.keys).toEqual({ maxAccidentals: 3, modes: 'major' }) // modes from defaults
      expect(r.settings.timeoutSeconds).toBe(10)
    }
  })

  it('survives a trip through JSON text', () => {
    const r = parseSettings({
      hands: ['LH', 'RH'],
      notesPerHand: [1, 2],
      goal: { medianSeconds: 2, accuracy: 0.9, reps: 20 },
    })
    if (!r.ok) throw new Error('should be valid')
    expect(parseSettings(JSON.parse(JSON.stringify(r.settings)))).toEqual(r)
  })

  it('allows no timeout (null) and an explicit key list', () => {
    const r = parseSettings({
      timeoutSeconds: null,
      keys: { explicit: ['C major', 'Eb major', 'F# minor', 'A♭ minor'] },
    })
    expect(r.ok).toBe(true)
  })
})

describe('parseSettings: readable errors that name the field', () => {
  it('rejects non-objects', () => {
    expect(errorsFor('hi')).toEqual(['settings: must be a JSON object'])
    expect(errorsFor(null)).toHaveLength(1)
    expect(errorsFor([1])).toHaveLength(1)
  })

  it.each([
    [{ name: '' }, /^name: must be 1 to 60 characters/],
    [{ hands: [] }, /^hands: must be a non-empty list of "LH", "RH", "both"/],
    [{ hands: ['left'] }, /hands\[0\]: "left" is not one of/],
    [{ hands: ['RH', 'RH'] }, /hands: must not list the same option twice/],
    [{ notesPerHand: [] }, /^notesPerHand: must be a non-empty list of whole numbers from 1 to 5/],
    [{ notesPerHand: [3, 9] }, /notesPerHand\[1\]: must be a whole number from 1 to 5 \(got 9\)/],
    [
      { notesPerHand: [5] },
      /notesPerHand\[0\]: 5 notes per hand \(extended chords\) is not supported yet/,
    ],
    [
      { keys: { maxAccidentals: 9 } },
      /^keys.maxAccidentals: must be a whole number from 0 to 7 \(got 9\)/,
    ],
    [
      { keys: { modes: 'dorian' } },
      /keys.modes: must be "major", "minor" or "both" \(got "dorian"\)/,
    ],
    [{ keys: { explicit: ['H major'] } }, /keys.explicit\[0\]: "H major" is not a key/],
    [{ inversions: 'yes' }, /inversions: must be true or false \(got "yes"\)/],
    [{ chromaticNotes: 'lots' }, /chromaticNotes: must be "off" or "occasional"/],
    [{ ledgerLines: 4 }, /ledgerLines: must be a whole number from 0 to 3 \(got 4\)/],
    [{ range: { low: 'X9', high: 'F5' } }, /range.low: "X9" is not a note name/],
    [{ range: { low: 'F5', high: 'G2' } }, /range: low \(F5\) must be below high \(G2\)/],
    [
      { timeoutSeconds: 0 },
      /timeoutSeconds: must be null \(no timeout\) or a number from 1 to 120/,
    ],
    [{ octaveStrictness: 'loose' }, /octaveStrictness: must be "exact" or "any"/],
    [
      { goal: { medianSeconds: -1, accuracy: 2, reps: 0 } },
      /goal.medianSeconds: must be a number above 0/,
    ],
    [
      { notesPerHand: [2], intervalSizes: [1] },
      /intervalSizes\[0\]: must be a whole number from 2 to 9 \(got 1\)/,
    ],
  ])('%j', (input, pattern) => {
    expect(errorsFor(input).some((e) => pattern.test(e))).toBe(true)
  })

  it('reports every problem at once, not just the first', () => {
    const errors = errorsFor({
      name: '',
      hands: [],
      keys: { maxAccidentals: 99, modes: 'x' },
      ledgerLines: -1,
    })
    expect(errors.length).toBeGreaterThanOrEqual(5)
  })

  it('uses the same notes-per-hand rules for one hand and both hands', () => {
    for (const hands of [['RH'], ['LH'], ['both'], ['LH', 'RH', 'both']]) {
      expect(parseSettings({ hands, notesPerHand: [1, 2, 3, 4] }).ok).toBe(true)
      expect(parseSettings({ hands, notesPerHand: [] }).ok).toBe(false)
      expect(parseSettings({ hands, notesPerHand: [5] }).ok).toBe(false)
    }
  })

  it('warns about unknown settings instead of failing, and drops them', () => {
    const r = parseSettings({ hands: ['RH'], flavour: 'spicy' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.warnings).toEqual(['flavour: unknown setting, ignored'])
      expect('flavour' in r.settings).toBe(false)
    }
  })
})

describe('versioning and migration', () => {
  it('stamps the current version', () => {
    expect(SETTINGS_VERSION).toBe(2)
    const r = parseSettings({})
    expect(r.ok && r.settings.version).toBe(2)
  })

  it('upgrades the old unversioned shape (version 0)', () => {
    const r = parseSettings({
      name: 'Old',
      hand: 'either',
      noteCount: 3,
      accidentals: 2,
      inversion: true,
      timeout: 0,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.settings.hands).toEqual(['LH', 'RH'])
      expect(r.settings.notesPerHand).toEqual([3])
      expect(r.settings.keys.maxAccidentals).toBe(2)
      expect(r.settings.inversions).toBe(true)
      expect(r.settings.timeoutSeconds).toBeNull()
      expect(r.settings.version).toBe(2)
    }
  })

  it('maps each old hand choice', () => {
    const hands = (hand: string) => {
      const r = parseSettings({ hand })
      return r.ok ? r.settings.hands : null
    }
    expect(hands('left')).toEqual(['LH'])
    expect(hands('right')).toEqual(['RH'])
    expect(hands('both')).toEqual(['both'])
  })

  it('upgrades version 1 settings: the separate two-hand block is dropped and its note counts become notesPerHand', () => {
    const r = parseSettings({
      version: 1,
      name: 'Old two-hand level',
      hands: ['both'],
      notesPerHand: [1],
      twoHand: { voicings: ['bass-root'], chordSizes: ['triad'], lhNotes: [1, 2], rhNotes: [3, 4] },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.settings.version).toBe(2)
      expect(r.settings.notesPerHand).toEqual([1, 2, 3, 4])
      expect('twoHand' in r.settings).toBe(false)
      expect(r.warnings).toEqual([]) // migrated cleanly, nothing left over
    }
  })

  it('keeps notesPerHand for version 1 one-hand settings', () => {
    const r = parseSettings({
      version: 1,
      hands: ['RH'],
      notesPerHand: [2, 3],
      twoHand: { voicings: ['split'] },
    })
    expect(r.ok && r.settings.notesPerHand).toEqual([2, 3])
  })

  it('rejects settings from a newer app with a clear message', () => {
    const [e] = errorsFor({ version: 3 })
    expect(e).toMatch(/version: 3 is newer than this app understands \(2\)/)
  })

  it('treats a sparse file without a version as the current format, not as legacy', () => {
    const r = parseSettings({ hands: ['LH'], notesPerHand: [2] })
    expect(r.ok && r.settings.hands).toEqual(['LH'])
    expect(r.ok && r.settings.notesPerHand).toEqual([2])
  })

  it('rejects nonsense versions', () => {
    expect(errorsFor({ version: 'one' })[0]).toMatch(/version: must be a whole number/)
    expect(migrateSettings({ version: -3 })).toHaveProperty('error')
  })
})

describe('custom presets: merge and override', () => {
  const base = parseSettings({
    name: 'Base',
    hands: ['RH'],
    keys: { maxAccidentals: 2, modes: 'both' },
    notesPerHand: [3],
  })
  if (!base.ok) throw new Error('base should be valid')

  it('overrides replace values and lists, and merge nested objects', () => {
    const r = mergeSettings(base.settings, {
      name: 'Mine',
      notesPerHand: [1, 2],
      keys: { maxAccidentals: 5 },
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.settings.name).toBe('Mine')
      expect(r.settings.notesPerHand).toEqual([1, 2])
      expect(r.settings.keys).toEqual({ maxAccidentals: 5, modes: 'both' }) // modes kept from the base
      expect(r.settings.hands).toEqual(['RH']) // untouched
    }
  })

  it('does not change the base', () => {
    mergeSettings(base.settings, { hands: ['LH'] })
    expect(base.settings.hands).toEqual(['RH'])
  })

  it('validates the result with readable errors', () => {
    const r = mergeSettings(base.settings, { keys: { maxAccidentals: 12 } })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.errors[0]).toMatch(/keys.maxAccidentals/)
    expect(mergeSettings(base.settings, 5).ok).toBe(false)
  })
})

describe('key names', () => {
  it('parses sharps, flats (ASCII or symbols) and modes', () => {
    expect(keyName(parseKeyName('Eb major')!)).toBe('E♭ major')
    expect(keyName(parseKeyName('F# minor')!)).toBe('F♯ minor')
    expect(keyName(parseKeyName('A♭ minor')!)).toBe('A♭ minor')
    expect(keyName(parseKeyName('C major')!)).toBe('C major')
    expect(parseKeyName('D# major')).toBeNull() // no such key (9 sharps)
    expect(parseKeyName('nonsense')).toBeNull()
  })
})
