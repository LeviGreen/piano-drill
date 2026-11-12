import { describe, expect, it } from 'vitest'
import { diatonicChords } from './chords'
import { validateTarget } from './constraints'
import { keysUpTo, targetSignature, type NotesPerHand } from './generator'
import { keyName, keySignature } from './keys'
import { pitchClassSet } from './pitch'
import { DEFAULT_TWO_HAND_CONFIG, TwoHandGenerator, type TwoHandConfig } from './twoHand'
import type { Target } from './target'

const config = (over: Partial<TwoHandConfig>): TwoHandConfig => ({
  ...DEFAULT_TWO_HAND_CONFIG,
  keys: keysUpTo(3),
  ...over,
})

const N = 10_000
const run = (c: TwoHandConfig, seed = 5): Target[] => {
  const g = new TwoHandGenerator(c, seed)
  return Array.from({ length: N }, () => g.next())
}

/** Pitch-class sets of every diatonic chord of a key (triads and sevenths, natural and harmonic minor). */
function chordSets(key: Target['key']): Set<string> {
  const out = new Set<string>()
  for (const size of ['triad', 'seventh'] as const) {
    for (const form of ['natural', 'harmonic'] as const) {
      for (const c of diatonicChords(key, size, { form })) out.add(pitchClassSet(c.pitches).join())
    }
  }
  return out
}

const CONFIGS: [string, TwoHandConfig][] = [
  ['1-3 notes per hand, up to 3 accidentals', config({})],
  ['1 note per hand (a bass note and one more)', config({ notesPerHand: [1] })],
  ['3 notes per hand, root position', config({ notesPerHand: [3], inversions: false })],
  [
    '1 to 4 notes per hand (sevenths), 5 accidentals',
    config({ notesPerHand: [1, 2, 3, 4], keys: keysUpTo(5) }),
  ],
  [
    'all 30 keys, everything',
    config({ notesPerHand: [1, 2, 3, 4], keys: keysUpTo(7), minorForm: 'either' }),
  ],
]

describe.each(CONFIGS)('10,000 two-hand targets: %s', (_n, cfg) => {
  const targets = run(cfg)

  it('every target is playable: left hand below right, within reach, staves and range', () => {
    for (const t of targets) {
      expect(validateTarget(t, cfg.constraints).ok, targetSignature(t)).toBe(true)
      expect(t.parts.map((p) => p.hand)).toEqual(['LH', 'RH'])
      expect(t.parts.map((p) => p.clef)).toEqual(['bass', 'treble'])
      expect(Math.max(...t.parts[0].pitches.map((p) => p.midi))).toBeLessThan(
        Math.min(...t.parts[1].pitches.map((p) => p.midi)),
      )
    }
  })

  it('each hand gets a note count from the settings, and the left hand is rooted', () => {
    for (const t of targets) {
      expect(cfg.notesPerHand).toContain(t.parts[0].pitches.length as NotesPerHand)
      expect(cfg.notesPerHand).toContain(t.parts[1].pitches.length as NotesPerHand)
      // The lowest left-hand note is the chord root: its letter is the chord's name.
      expect(t.parts[0].pitches[0].spelling.letter).toBe(t.parts[0].label!.match(/^[A-G]/)![0])
    }
  })

  it('together the hands are one recognisable diatonic chord: only chord tones, always the root and third', () => {
    for (const t of targets) {
      const all = t.parts.flatMap((p) => p.pitches)
      const pcs = pitchClassSet(all)
      const total = all.length
      const sets = chordSets(t.key)
      const chordSize = t.content.type === 'triad' ? 3 : 4
      if (total >= chordSize) {
        expect(
          sets.has(pcs.join()),
          `${keyName(t.key)} ${t.parts[0].label} ${targetSignature(t)}`,
        ).toBe(true) // all tones
      } else {
        // A dyad (two notes): a subset of one chord that still contains root and third.
        expect(pcs.length, targetSignature(t)).toBeGreaterThanOrEqual(2)
        expect([...sets].some((s) => pcs.every((p) => s.split(',').map(Number).includes(p)))).toBe(
          true,
        )
      }
    }
  }, 20_000) // 10,000 targets: about 1 to 2 s normally, but over the 5 s default on a busy machine

  it('uses sevenths only when a hand has 4 notes', () => {
    for (const t of targets) {
      const most = Math.max(t.parts[0].pitches.length, t.parts[1].pitches.length)
      expect(t.content.type).toBe(most >= 4 ? 'seventh' : 'triad')
    }
  })

  it('never repeats back-to-back, no long key runs, keys used roughly evenly', () => {
    let run = 0
    const counts = new Map<string, number>()
    for (let i = 0; i < targets.length; i++) {
      counts.set(keyName(targets[i].key), (counts.get(keyName(targets[i].key)) ?? 0) + 1)
      if (i === 0) continue
      expect(targetSignature(targets[i])).not.toBe(targetSignature(targets[i - 1]))
      run = keyName(targets[i].key) === keyName(targets[i - 1].key) ? run + 1 : 0
      expect(run + 1).toBeLessThanOrEqual(cfg.maxSameKeyRun)
    }
    expect(counts.size).toBe(cfg.keys.length)
    const expected = N / cfg.keys.length
    for (const [k, c] of counts) {
      expect(c, k).toBeGreaterThan(expected * 0.8)
      expect(c, k).toBeLessThan(expected * 1.2)
    }
  })
})

describe('inversions setting', () => {
  it('off: the right hand climbs in chord order and never repeats a tone', () => {
    const targets = run(config({ notesPerHand: [3], inversions: false }))
    const order = (p: Target) => p.parts[1].pitches.length
    for (const t of targets.slice(0, 2000)) {
      expect(order(t)).toBe(3)
      expect(t.content.inversion).toBe(0) // root position
    }
  })

  it('on: the right hand also appears inverted', () => {
    const inv = new Set(
      run(config({ notesPerHand: [3], inversions: true })).map((t) => t.content.inversion),
    )
    expect([...inv].sort()).toEqual([0, 1, 2])
  })
})

describe('behaviour', () => {
  it('gives a bass note plus one more with 1 note per hand (a dyad that names the chord)', () => {
    const g = new TwoHandGenerator(config({ notesPerHand: [1] }), 3)
    for (let i = 0; i < 300; i++) {
      const t = g.next()
      expect(t.parts[0].pitches).toHaveLength(1)
      expect(t.parts[1].pitches).toHaveLength(1)
    }
  })

  it('rejects empty settings and impossible ranges with clear errors', () => {
    expect(() => new TwoHandGenerator(config({ keys: [] }))).toThrow(RangeError)
    expect(() => new TwoHandGenerator(config({ notesPerHand: [] }))).toThrow(RangeError)
    const impossible = config({
      constraints: { ...config({}).constraints, lowestMidi: 100, highestMidi: 101 },
    })
    expect(() => new TwoHandGenerator(impossible).next()).toThrow(/no playable chords/)
  })

  it('is deterministic per seed and numbers its targets', () => {
    const sig = (g: TwoHandGenerator) => Array.from({ length: 20 }, () => targetSignature(g.next()))
    expect(sig(new TwoHandGenerator(config({}), 9))).toEqual(
      sig(new TwoHandGenerator(config({}), 9)),
    )
    expect(new TwoHandGenerator(config({}), 1).next().id).toBe('t1')
  })

  it('works in a single key', () => {
    const g = new TwoHandGenerator(
      config({ keys: [keySignature(0, 'major')], maxSameKeyRun: 99 }),
      2,
    )
    for (let i = 0; i < 100; i++) expect(keyName(g.next().key)).toBe('C major')
  })
})
