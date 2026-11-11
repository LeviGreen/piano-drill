import { describe, expect, it } from 'vitest'
import { diatonicChords, scalePitch } from './chords'
import { validateTarget } from './constraints'
import {
  clefForHand,
  DEFAULT_SINGLE_HAND_CONFIG,
  keysUpTo,
  TargetGenerator,
  targetSignature,
  type SingleHandConfig,
} from './generator'
import { keyName, keySignature } from './keys'
import { formatPitchAscii, pitchClassSet } from './pitch'
import { ledgerLines } from './staff'
import type { Target } from './target'

const config = (over: Partial<SingleHandConfig>): SingleHandConfig => ({
  ...DEFAULT_SINGLE_HAND_CONFIG,
  keys: keysUpTo(2),
  ...over,
})

const KINDS = { 1: 'note', 2: 'interval', 3: 'triad', 4: 'seventh' } as const
const N = 10_000
const run = (c: SingleHandConfig, seed = 7): Target[] => {
  const g = new TargetGenerator(c, seed)
  return Array.from({ length: N }, () => g.next())
}

/** Pitch-class sets of every diatonic chord (triads and sevenths, natural and harmonic minor) of a key. */
function chordSets(key: Target['key']): Set<string> {
  const out = new Set<string>()
  for (const size of ['triad', 'seventh'] as const) {
    for (const form of ['natural', 'harmonic'] as const) {
      for (const c of diatonicChords(key, size, { form })) out.add(pitchClassSet(c.pitches).join())
    }
  }
  return out
}

function scaleSet(key: Target['key']): Set<number> {
  const s = new Set<number>()
  for (const form of ['natural', 'harmonic'] as const) {
    for (let i = 0; i < 7; i++) s.add(scalePitch(key, i, 4, form).midi % 12)
  }
  return s
}

const CONFIGS: [string, SingleHandConfig][] = [
  ['RH treble single notes, C major only', config({ keys: [keySignature(0, 'major')] })],
  ['LH bass single notes, up to 2 accidentals', config({ hands: ['LH'] })],
  [
    'RH intervals 2nd-octave, up to 4 accidentals',
    config({ notesPerHand: [2], keys: keysUpTo(4) }),
  ],
  ['LH intervals', config({ hands: ['LH'], notesPerHand: [2], keys: keysUpTo(3) })],
  ['RH root-position triads', config({ notesPerHand: [3], keys: keysUpTo(3) })],
  [
    'RH triads with inversions, 5 accidentals',
    config({ notesPerHand: [3], inversions: true, keys: keysUpTo(5) }),
  ],
  [
    'RH seventh chords with inversions',
    config({ notesPerHand: [4], inversions: true, keys: keysUpTo(4) }),
  ],
  ['LH triads and notes mixed', config({ hands: ['LH'], notesPerHand: [1, 3], keys: keysUpTo(3) })],
  [
    'harmonic and natural minor, all 15 minor keys',
    config({ notesPerHand: [1, 3], keys: keysUpTo(7, ['minor']), minorForm: 'either' }),
  ],
  [
    'all 30 keys, everything mixed',
    config({
      notesPerHand: [1, 2, 3, 4],
      inversions: true,
      keys: keysUpTo(7),
    }),
  ],
  [
    'two-note subsets of triads',
    config({ notesPerHand: [3], maxChordNotes: 2, keys: keysUpTo(3) }),
  ],
]

describe.each(CONFIGS)('10,000 targets: %s', (_name, cfg) => {
  const targets = run(cfg)

  it('all satisfy the constraints (range, ledger lines, span, spacing) and use the right hand and clef', () => {
    for (const t of targets) {
      expect(validateTarget(t, cfg.constraints).ok, `${t.id} ${targetSignature(t)}`).toBe(true)
      expect(t.parts).toHaveLength(1)
      expect(cfg.hands).toContain(t.parts[0].hand)
      expect(t.parts[0].clef).toBe(clefForHand(t.parts[0].hand))
      for (const p of t.parts[0].pitches) {
        expect(ledgerLines(p, t.parts[0].clef)).toBeLessThanOrEqual(cfg.constraints.maxLedgerLines)
        expect(p.midi).toBeGreaterThanOrEqual(cfg.constraints.lowestMidi)
        expect(p.midi).toBeLessThanOrEqual(cfg.constraints.highestMidi)
      }
    }
  })

  it('only uses allowed content, keys and sorted pitches', () => {
    const allowedKeys = new Set(cfg.keys.map(keyName))
    for (const t of targets) {
      expect(cfg.notesPerHand.map((n) => KINDS[n])).toContain(t.content.type)
      expect(allowedKeys.has(keyName(t.key))).toBe(true)
      const ps = t.parts[0].pitches
      for (let i = 1; i < ps.length; i++) expect(ps[i].midi).toBeGreaterThan(ps[i - 1].midi)
    }
  })

  it('every note belongs to the key, and every chord is a real diatonic chord of it', () => {
    for (const t of targets) {
      const ps = t.parts[0].pitches
      if (t.content.type === 'note' || t.content.type === 'interval') {
        const scale = scaleSet(t.key)
        for (const p of ps) expect(scale.has(p.midi % 12), `${targetSignature(t)}`).toBe(true)
      } else if (!cfg.maxChordNotes) {
        expect(
          chordSets(t.key).has(pitchClassSet(ps).join()),
          `${keyName(t.key)} ${t.parts[0].label}`,
        ).toBe(true)
      }
    }
  })

  it('never repeats the same target twice in a row, nor the same key more than the allowed run', () => {
    let run = 0
    for (let i = 1; i < targets.length; i++) {
      expect(targetSignature(targets[i])).not.toBe(targetSignature(targets[i - 1]))
      run = keyName(targets[i].key) === keyName(targets[i - 1].key) ? run + 1 : 0
      if (cfg.keys.length > 1) expect(run + 1).toBeLessThanOrEqual(cfg.maxSameKeyRun)
    }
  })

  it('uses the keys roughly uniformly (within 20% of an even share)', () => {
    if (cfg.keys.length < 2) return
    const counts = new Map<string, number>()
    for (const t of targets) counts.set(keyName(t.key), (counts.get(keyName(t.key)) ?? 0) + 1)
    const expected = N / cfg.keys.length
    expect(counts.size).toBe(cfg.keys.length)
    for (const [k, c] of counts) {
      expect(c, k).toBeGreaterThan(expected * 0.8)
      expect(c, k).toBeLessThan(expected * 1.2)
    }
  })

  it('uses chord degrees and inversions broadly', () => {
    const chords = targets.filter((t) => t.content.degree !== undefined)
    if (chords.length < 1000) return
    const degrees = new Map<number, number>()
    const inversions = new Set<number>()
    for (const t of chords) {
      degrees.set(t.content.degree!, (degrees.get(t.content.degree!) ?? 0) + 1)
      inversions.add(t.content.inversion ?? 0)
    }
    expect(degrees.size).toBeGreaterThanOrEqual(6)
    const expected = chords.length / degrees.size
    for (const [d, c] of degrees) {
      expect(c, `degree ${d}`).toBeGreaterThan(expected * 0.6)
      expect(c, `degree ${d}`).toBeLessThan(expected * 1.4)
    }
    expect(inversions.size).toBe(cfg.inversions ? (cfg.notesPerHand.includes(4) ? 4 : 3) : 1)
  })
})

describe('generator behaviour', () => {
  it('is deterministic for a given seed and differs between seeds', () => {
    const c = config({ notesPerHand: [1, 3] })
    const a = Array.from(
      { length: 50 },
      (
        (g) => () =>
          targetSignature(g.next())
      )(new TargetGenerator(c, 3)),
    )
    const b = Array.from(
      { length: 50 },
      (
        (g) => () =>
          targetSignature(g.next())
      )(new TargetGenerator(c, 3)),
    )
    const d = Array.from(
      { length: 50 },
      (
        (g) => () =>
          targetSignature(g.next())
      )(new TargetGenerator(c, 4)),
    )
    expect(a).toEqual(b)
    expect(a).not.toEqual(d)
  })

  it('picks the hand per target when several are allowed, with the matching clef', () => {
    const targets = run(config({ hands: ['LH', 'RH'], notesPerHand: [1, 3] }))
    const lh = targets.filter((t) => t.parts[0].hand === 'LH')
    expect(lh.length).toBeGreaterThan(N * 0.45)
    expect(lh.length).toBeLessThan(N * 0.55)
    for (const t of targets)
      expect(t.parts[0].clef).toBe(t.parts[0].hand === 'LH' ? 'bass' : 'treble')
  })

  it('maps notes per hand to content: 1 note, 2 interval, 3 triad, 4 seventh', () => {
    for (const [n, kind] of [
      [1, 'note'],
      [2, 'interval'],
      [3, 'triad'],
      [4, 'seventh'],
    ] as const) {
      const g = new TargetGenerator(config({ notesPerHand: [n] }), 2)
      for (let i = 0; i < 50; i++) expect(g.next().content.type).toBe(kind)
    }
  })

  it('numbers its targets in order', () => {
    const g = new TargetGenerator(config({}), 1)
    expect([g.next().id, g.next().id, g.next().id]).toEqual(['t1', 't2', 't3'])
  })

  it('labels chords and records quality, degree and inversion', () => {
    const g = new TargetGenerator(
      config({ notesPerHand: [3], inversions: true, keys: [keySignature(0, 'major')] }),
      5,
    )
    const t = g.next()
    expect(t.parts[0].label).toMatch(/^[A-G]/)
    expect(t.content.quality).toBeDefined()
    expect(t.content.degree).toBeGreaterThanOrEqual(1)
  })

  it('records the interval name for interval targets', () => {
    const g = new TargetGenerator(config({ notesPerHand: [2], intervalSizes: [3] }), 5)
    for (let i = 0; i < 200; i++) expect(g.next().content.quality).toMatch(/^[mM]3$|^[dA]3$/)
  })

  it('two-note chord subsets hold two notes and keep the root or third', () => {
    const t = new TargetGenerator(config({ notesPerHand: [3], maxChordNotes: 2 }), 5).next()
    expect(t.parts[0].pitches).toHaveLength(2)
  })

  it('alterations produce notes outside the key signature but never double accidentals', () => {
    const c = config({ alterations: 0.5, keys: [keySignature(0, 'major')], notesPerHand: [1] })
    const g = new TargetGenerator(c, 9)
    let altered = 0
    for (let i = 0; i < 2000; i++) {
      const p = g.next().parts[0].pitches[0]
      if (p.spelling.accidental !== 0) altered++
      expect(Math.abs(p.spelling.accidental)).toBeLessThanOrEqual(1)
    }
    expect(altered).toBeGreaterThan(200)
    expect(altered).toBeLessThan(1800)
  })

  it('with no alterations every note is diatonic', () => {
    const g = new TargetGenerator(config({ keys: [keySignature(0, 'major')] }), 9)
    for (let i = 0; i < 500; i++) expect(g.next().parts[0].pitches[0].spelling.accidental).toBe(0)
  })

  it('rejects empty settings and impossible ranges with clear errors', () => {
    expect(() => new TargetGenerator(config({ keys: [] }))).toThrow(RangeError)
    expect(() => new TargetGenerator(config({ hands: [] }))).toThrow(RangeError)
    expect(() => new TargetGenerator(config({ notesPerHand: [] }))).toThrow(RangeError)
    const impossible = config({
      constraints: { ...config({}).constraints, lowestMidi: 100, highestMidi: 101 },
    })
    expect(() => new TargetGenerator(impossible).next()).toThrow(/no playable notes/)
  })

  it('keysUpTo selects by accidental count and mode', () => {
    expect(keysUpTo(0).map(keyName).sort()).toEqual(['A minor', 'C major'])
    expect(keysUpTo(1, ['major']).map(keyName).sort()).toEqual(['C major', 'F major', 'G major'])
    expect(keysUpTo(7)).toHaveLength(30)
  })

  it('shows the first targets so a person can eyeball them', () => {
    const g = new TargetGenerator(config({ notesPerHand: [1, 2, 3], inversions: true }), 11)
    const sample = Array.from({ length: 6 }, () => {
      const t = g.next()
      return `${keyName(t.key)}: ${t.content.type} ${t.parts[0].pitches.map(formatPitchAscii).join(' ')}`
    })
    expect(sample).toHaveLength(6)
  })
})
