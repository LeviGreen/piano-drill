import { diatonicChord, type ChordRole, type MinorForm } from './chords'
import { DEFAULT_CONSTRAINTS, validateTarget, type Constraints } from './constraints'
import { targetSignature, type NotesPerHand } from './generator'
import { KeyRotation } from './keyRotation'
import type { KeySignature } from './keys'
import { pitch, type Pitch } from './pitch'
import { mulberry32, pick, randInt, shuffled, type Rng } from './random'
import type { HandPart, Target } from './target'

/**
 * Settings for targets played with both hands at once. They mirror the one-hand settings: `notesPerHand`
 * is the same list (1 note, 2, 3 or 4), and each hand gets a count drawn from it.
 */
export type TwoHandConfig = {
  keys: KeySignature[]
  notesPerHand: NotesPerHand[]
  /** When false, the right hand is always in root position (its tones stack upward in chord order). */
  inversions: boolean
  minorForm: MinorForm | 'either'
  maxSameKeyRun: number
  constraints: Constraints
}

export const DEFAULT_TWO_HAND_CONFIG: Omit<TwoHandConfig, 'keys'> = {
  notesPerHand: [1, 2, 3],
  inversions: true,
  minorForm: 'natural',
  maxSameKeyRun: 2,
  constraints: DEFAULT_CONSTRAINTS,
}

const ROLE_ORDER: ChordRole[] = ['root', 'third', 'fifth', 'seventh']
// Where each hand's notes may sit (MIDI): the left hand up to F4 (two ledger lines above the bass staff), the right
// hand down to G3 (two ledger lines below the treble staff). The staves and ledger-line rules in `constraints` do the
// precise checking; this just keeps the search small.
const LH_TOP = 65
const RH_BOTTOM = 55

type Tone = { role: ChordRole; pitch: Pitch }

/** Every octave of a chord tone that falls in [low, high]. */
function octavesOf(
  role: ChordRole,
  spelling: Pitch['spelling'],
  low: number,
  high: number,
): Tone[] {
  const out: Tone[] = []
  for (let octave = 0; octave <= 8; octave++) {
    const p = pitch(spelling.letter, spelling.accidental, octave)
    if (p.midi >= low && p.midi <= high) out.push({ role, pitch: p })
  }
  return out
}

const byPitch = (a: Tone, b: Tone): number => a.pitch.midi - b.pitch.midi

/**
 * Generates two-hand targets that read as ONE diatonic chord. The left hand always plays the root as its lowest
 * note; the right hand plays chord tones above it. Each hand gets a note count from `notesPerHand`. Only
 * playable results are kept (left hand below right, within reach and staff, no muddy low intervals), and the
 * hands together always include the root and third, and every chord tone when there are enough notes.
 */
export class TwoHandGenerator {
  readonly config: TwoHandConfig
  private readonly rng: Rng
  private readonly rotation: KeyRotation
  private count = 0
  private lastSignature = ''

  constructor(config: TwoHandConfig, seed = 1) {
    if (config.keys.length === 0) throw new RangeError('config.keys must not be empty')
    if (config.notesPerHand.length === 0)
      throw new RangeError('config.notesPerHand must not be empty')
    this.config = config
    this.rng = mulberry32(seed)
    this.rotation = new KeyRotation(config.keys, config.maxSameKeyRun, this.rng)
  }

  next(): Target {
    for (let attempt = 0; attempt < 500; attempt++) {
      const key = this.rotation.choose()
      const target = this.build(key)
      if (!target) continue
      const signature = targetSignature(target)
      if (signature === this.lastSignature) continue
      this.lastSignature = signature
      target.id = `t${++this.count}`
      this.rotation.commit(key)
      return target
    }
    throw new Error(
      'Could not generate a valid two-hand target; the settings may leave no playable chords in range',
    )
  }

  private build(key: KeySignature): Target | null {
    const { config, rng } = this
    const lhN = pick(rng, config.notesPerHand)
    const rhN = pick(rng, config.notesPerHand)
    const size = Math.max(lhN, rhN) >= 4 ? 'seventh' : 'triad'
    const degree = 1 + randInt(rng, 7)
    const form: MinorForm =
      key.mode === 'major'
        ? 'natural'
        : config.minorForm === 'either'
          ? pick(rng, ['natural', 'harmonic'] as const)
          : config.minorForm
    const chord = diatonicChord(key, degree, size, { octave: 4, form })
    const roles = ROLE_ORDER.slice(0, size === 'triad' ? 3 : 4)
    // With enough notes every chord tone is played; with very few, at least the root and third.
    const required = lhN + rhN >= roles.length ? roles : roles.slice(0, 2)

    const { lowestMidi, highestMidi } = config.constraints
    const lhPool = chord.tones.flatMap((t) =>
      octavesOf(t.role, t.pitch.spelling, lowestMidi, LH_TOP),
    )
    const rhPool = chord.tones.flatMap((t) =>
      octavesOf(t.role, t.pitch.spelling, RH_BOTTOM, highestMidi),
    )
    const lhRoots = lhPool.filter((t) => t.role === 'root')
    if (lhRoots.length === 0 || rhPool.length < rhN) return null

    for (let tries = 0; tries < 40; tries++) {
      const root = pick(rng, lhRoots)
      const above = shuffled(
        rng,
        lhPool.filter((t) => t.pitch.midi > root.pitch.midi),
      ).slice(0, lhN - 1)
      if (above.length < lhN - 1) continue
      const lh = [root, ...above].sort(byPitch)
      const rh = shuffled(rng, rhPool).slice(0, rhN).sort(byPitch)

      if (new Set(rh.map((t) => t.pitch.midi)).size !== rh.length) continue
      const heard = new Set([...lh, ...rh].map((t) => t.role))
      if (!required.every((r) => heard.has(r))) continue
      // Root position for the right hand: its tones climb in chord order, never repeating a role.
      if (!config.inversions) {
        const idx = rh.map((t) => ROLE_ORDER.indexOf(t.role))
        if (idx.some((v, i) => i > 0 && v <= idx[i - 1])) continue
      }

      const label = chord.label
      const parts: HandPart[] = [
        { hand: 'LH', clef: 'bass', pitches: lh.map((t) => t.pitch), label },
        { hand: 'RH', clef: 'treble', pitches: rh.map((t) => t.pitch), label },
      ]
      const rhInversion = rhN >= 3 ? ROLE_ORDER.indexOf(rh[0].role) : 0
      const target: Target = {
        id: '',
        key,
        parts,
        content: { type: size, quality: chord.quality, inversion: rhInversion, degree },
      }
      if (validateTarget(target, config.constraints).ok) return target
    }
    return null
  }
}
