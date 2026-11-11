import { describe, expect, it } from 'vitest'
import { diatonicChords } from './chords'
import { validateTarget } from './constraints'
import { keysUpTo, targetSignature } from './generator'
import { keyName, keySignature } from './keys'
import { pitchClassSet } from './pitch'
import { DEFAULT_TWO_HAND_CONFIG, TwoHandGenerator, type TwoHandConfig } from './twoHand'
import { templateById, VOICING_TEMPLATES } from './voicing'
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
function chordSets(key: Target['key']): Map<string, string> {
  const out = new Map<string, string>()
  for (const size of ['triad', 'seventh'] as const) {
    for (const form of ['natural', 'harmonic'] as const) {
      for (const c of diatonicChords(key, size, { form }))
        out.set(pitchClassSet(c.pitches).join(), c.label)
    }
  }
  return out
}

const CONFIGS: [string, TwoHandConfig][] = [
  ['all templates, triads, up to 3 accidentals', config({})],
  [
    'all templates, triads and sevenths, 5 accidentals',
    config({ chordSizes: ['triad', 'seventh'], keys: keysUpTo(5) }),
  ],
  [
    'bass + chord voicings only, root position',
    config({
      templates: ['bass-root', 'bass-root-fifth', 'bass-octave'].map(templateById),
      inversions: false,
    }),
  ],
  [
    'shell voicings, sevenths',
    config({
      templates: ['shell-seventh'].map(templateById),
      chordSizes: ['seventh'],
      lhNotes: [2],
      rhNotes: [1, 2],
    }),
  ],
  [
    'all 30 keys, everything',
    config({ chordSizes: ['triad', 'seventh'], keys: keysUpTo(7), minorForm: 'either' }),
  ],
]

describe.each(CONFIGS)('10,000 two-hand targets: %s', (_n, cfg) => {
  const targets = run(cfg)

  it('every target is playable: left hand below right, within reach, staves and range', () => {
    for (const t of targets) {
      expect(validateTarget(t, cfg.constraints).ok, targetSignature(t)).toBe(true)
      expect(t.parts.map((p) => p.hand)).toEqual(['LH', 'RH'])
      expect(t.parts.map((p) => p.clef)).toEqual(['bass', 'treble'])
      const lhTop = Math.max(...t.parts[0].pitches.map((p) => p.midi))
      const rhBottom = Math.min(...t.parts[1].pitches.map((p) => p.midi))
      expect(lhTop).toBeLessThan(rhBottom)
    }
  })

  it('every target is identifiable as a single diatonic chord of its key (all chord tones present, nothing else)', () => {
    for (const t of targets) {
      const all = t.parts.flatMap((p) => p.pitches)
      const set = pitchClassSet(all).join()
      expect(
        chordSets(t.key).has(set),
        `${keyName(t.key)} ${t.parts[0].label} ${targetSignature(t)}`,
      ).toBe(true)
    }
  })

  it('respects the allowed note counts per hand and uses allowed voicings and keys', () => {
    const allowedKeys = new Set(cfg.keys.map(keyName))
    const ids = new Set(cfg.templates.map((x) => x.id))
    for (const t of targets) {
      expect(cfg.lhNotes).toContain(t.parts[0].pitches.length)
      expect(cfg.rhNotes).toContain(t.parts[1].pitches.length)
      expect(ids.has(t.content.voicing!)).toBe(true)
      expect(allowedKeys.has(keyName(t.key))).toBe(true)
    }
  })

  it('uses every allowed template and every key, none repeats back-to-back, no long key runs', () => {
    expect(new Set(targets.map((t) => t.content.voicing)).size).toBeGreaterThanOrEqual(
      cfg.templates.filter((x) => x.sizes.some((s) => cfg.chordSizes.includes(s))).length - 1,
    )
    expect(new Set(targets.map((t) => keyName(t.key))).size).toBe(cfg.keys.length)
    let run = 0
    for (let i = 1; i < targets.length; i++) {
      expect(targetSignature(targets[i])).not.toBe(targetSignature(targets[i - 1]))
      run = keyName(targets[i].key) === keyName(targets[i - 1].key) ? run + 1 : 0
      expect(run + 1).toBeLessThanOrEqual(cfg.maxSameKeyRun)
    }
  })

  it('uses keys roughly evenly (within 20%)', () => {
    const counts = new Map<string, number>()
    for (const t of targets) counts.set(keyName(t.key), (counts.get(keyName(t.key)) ?? 0) + 1)
    const expected = N / cfg.keys.length
    for (const [k, c] of counts) {
      expect(c, k).toBeGreaterThan(expected * 0.8)
      expect(c, k).toBeLessThan(expected * 1.2)
    }
  })
})

describe('voicing templates', () => {
  it('has at least 4 data-driven templates, all with unique ids', () => {
    expect(VOICING_TEMPLATES.length).toBeGreaterThanOrEqual(4)
    expect(new Set(VOICING_TEMPLATES.map((t) => t.id)).size).toBe(VOICING_TEMPLATES.length)
    expect(new Set(VOICING_TEMPLATES.map((t) => t.kind)).size).toBeGreaterThanOrEqual(4)
  })

  it('each kind of voicing really has its shape', () => {
    const g = (id: string, size: 'triad' | 'seventh' = 'triad') =>
      new TwoHandGenerator(
        config({ templates: [templateById(id)], chordSizes: [size], keys: keysUpTo(2) }),
        3,
      )
    const sample = (id: string, size: 'triad' | 'seventh' = 'triad') => {
      const gen = g(id, size)
      return Array.from({ length: 300 }, () => gen.next())
    }
    for (const t of sample('bass-root')) {
      expect(t.parts[0].pitches).toHaveLength(1) // one bass note
      expect(t.parts[1].pitches.length).toBeGreaterThanOrEqual(3) // full chord on top
      expect(t.parts[0].pitches[0].spelling.letter).toBe(t.parts[0].label!.match(/^[A-G]/)![0]) // the root
    }
    for (const t of sample('bass-octave')) {
      const [a, b] = t.parts[0].pitches
      expect(b.midi - a.midi).toBe(12) // root and its octave
    }
    for (const t of sample('shell-triad')) {
      expect(t.parts[0].pitches).toHaveLength(2) // root and third
      expect(t.parts[1].pitches).toHaveLength(1) // fifth on top
    }
    for (const t of sample('shell-seventh', 'seventh')) {
      expect(t.parts[0].pitches).toHaveLength(2) // root and seventh
      expect(t.parts[1].pitches).toHaveLength(2) // third and fifth on top
    }
    for (const t of sample('octave-doubling')) {
      const rh = t.parts[1].pitches.map((p) => p.midi)
      const doubled = t.parts[0].pitches[0].midi
      expect(rh.some((m) => (m - doubled) % 12 === 0 && m - doubled >= 12)).toBe(true)
    }
    for (const t of sample('split')) {
      expect(Math.max(...t.parts[0].pitches.map((p) => p.midi))).toBeLessThan(60)
      expect(Math.min(...t.parts[1].pitches.map((p) => p.midi))).toBeGreaterThanOrEqual(60)
    }
  })

  it('rejects unknown ids and empty settings with clear errors', () => {
    expect(() => templateById('nope')).toThrow(RangeError)
    expect(() => new TwoHandGenerator(config({ templates: [] }))).toThrow(RangeError)
    expect(() => new TwoHandGenerator(config({ keys: [] }))).toThrow(RangeError)
    const impossible = config({
      constraints: { ...config({}).constraints, lowestMidi: 100, highestMidi: 101 },
    })
    expect(() => new TwoHandGenerator(impossible).next()).toThrow(/no playable voicings/)
  })

  it('is deterministic per seed and numbers its targets', () => {
    const a = new TwoHandGenerator(config({}), 9)
    const b = new TwoHandGenerator(config({}), 9)
    const run = (g: TwoHandGenerator) => Array.from({ length: 20 }, () => targetSignature(g.next()))
    expect(run(a)).toEqual(run(b))
    expect(new TwoHandGenerator(config({}), 1).next().id).toBe('t1')
  })

  it('a custom template can be added as plain data', () => {
    const custom = {
      id: 'bass-third',
      name: 'Bass third + chord',
      kind: 'bass-plus-chord' as const,
      sizes: ['triad' as const],
      lhRoles: ['third' as const],
      drops: [0],
    }
    const g = new TwoHandGenerator(
      config({ templates: [custom], keys: [keySignature(0, 'major')] }),
      2,
    )
    for (let i = 0; i < 100; i++) expect(g.next().content.voicing).toBe('bass-third')
  })
})
