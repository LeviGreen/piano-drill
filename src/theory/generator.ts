import { preferredSubset, diatonicChord, scalePitch, type MinorForm } from './chords'
import { DEFAULT_CONSTRAINTS, validateTarget, type Constraints } from './constraints'
import { ALL_KEYS, type KeySignature, type Mode } from './keys'
import { KeyRotation } from './keyRotation'
import {
  formatPitchAscii,
  intervalBetween,
  intervalName,
  pitch,
  type Accidental,
  type Pitch,
} from './pitch'
import { mulberry32, pick, randInt, shuffled, type Rng } from './random'
import type { Clef } from './staff'
import type { Hand, HandPart, Target } from './target'

export type SingleHandContent = 'note' | 'interval' | 'triad' | 'seventh'
export type NotesPerHand = 1 | 2 | 3 | 4

const KIND_FOR_COUNT: Record<NotesPerHand, SingleHandContent> = {
  1: 'note',
  2: 'interval',
  3: 'triad',
  4: 'seventh',
}
export const clefForHand = (hand: Hand): Clef => (hand === 'RH' ? 'treble' : 'bass')

/** Settings for one-hand targets (a slice of the difficulty model in design §3; PD-108 will wrap this). */
export type SingleHandConfig = {
  /**
   * Which hand plays each target; with several, one is picked at random per target ("either hand, one at a
   * time"). The clef is the hand's own: right hand treble, left hand bass.
   */
  hands: Hand[]
  /** Keys the targets may come from. */
  keys: KeySignature[]
  /** Content types to mix; one is picked uniformly per target. */
  /** Notes per hand to mix: 1 = single note, 2 = interval, 3 = triad, 4 = seventh chord. One is picked per target. */
  notesPerHand: NotesPerHand[]
  /** Diatonic sizes for interval content: 2 = second ... 8 = octave. */
  intervalSizes: number[]
  /** Allow inverted chords (otherwise root position only). */
  inversions: boolean
  /** Which minor scale chords and notes use; 'either' picks per target. */
  minorForm: MinorForm | 'either'
  /** Chance (0..1) that a note, or one note of an interval, is chromatically altered (a ±1 semitone change). */
  alterations: number
  /** Use only this many tones of a chord (see design §4.2), e.g. 2 from a triad. */
  maxChordNotes?: number
  /** The same key may not appear more than this many times in a row (when there is more than one key). */
  maxSameKeyRun: number
  constraints: Constraints
}

export const DEFAULT_SINGLE_HAND_CONFIG: Omit<SingleHandConfig, 'keys'> = {
  hands: ['RH'],
  notesPerHand: [1],
  intervalSizes: [2, 3, 4, 5, 6, 7, 8],
  inversions: false,
  minorForm: 'natural',
  alterations: 0,
  maxSameKeyRun: 2,
  constraints: DEFAULT_CONSTRAINTS,
}

/** Keys with at most `maxAccidentals` sharps or flats, in the given modes. */
export function keysUpTo(
  maxAccidentals: number,
  modes: Mode[] = ['major', 'minor'],
): KeySignature[] {
  return ALL_KEYS.filter((k) => modes.includes(k.mode) && Math.abs(k.accidentals) <= maxAccidentals)
}

/** A key plus the exact notes, for detecting back-to-back repeats. */
export function targetSignature(t: Target): string {
  const key = `${t.key.accidentals}${t.key.mode}`
  return `${key}|${t.parts.map((p) => `${p.hand}:${p.pitches.map(formatPitchAscii).join(',')}`).join('/')}`
}

const OCTAVE_SHIFTS = [-2, -1, 0, 1, 2, 3] // in octaves of scale degrees, applied around the key's octave 4

function alter(p: Pitch, rng: Rng): Pitch {
  const delta = rng() < 0.5 ? 1 : -1
  const acc = p.spelling.accidental + delta
  if (Math.abs(acc) > 1) return p // keep alterations to single sharps/flats/naturals
  return pitch(p.spelling.letter, acc as Accidental, p.spelling.octave)
}

/**
 * Generates one-hand targets: single notes, intervals, triads and seventh chords, with inversions,
 * respecting range/readability constraints, and avoiding exact repeats and long runs of one key.
 */
export class TargetGenerator {
  readonly config: SingleHandConfig
  private readonly rng: Rng
  private count = 0
  private lastSignature = ''
  private readonly rotation: KeyRotation
  private hand: Hand = 'RH'

  constructor(config: SingleHandConfig, seed = 1) {
    if (config.keys.length === 0) throw new RangeError('config.keys must not be empty')
    if (config.hands.length === 0) throw new RangeError('config.hands must not be empty')
    if (config.notesPerHand.length === 0)
      throw new RangeError('config.notesPerHand must not be empty')
    this.config = config
    this.rng = mulberry32(seed)
    this.rotation = new KeyRotation(config.keys, config.maxSameKeyRun, this.rng)
  }

  next(): Target {
    const { config, rng } = this
    for (let attempt = 0; attempt < 500; attempt++) {
      const key = this.rotation.choose()
      this.hand = pick(rng, config.hands)
      const kind = KIND_FOR_COUNT[pick(rng, config.notesPerHand)]
      const target = this.build(key, kind)
      if (!target) continue
      const signature = targetSignature(target)
      if (signature === this.lastSignature) continue
      this.lastSignature = signature
      target.id = `t${++this.count}`
      this.rotation.commit(key)
      return target
    }
    throw new Error(
      'Could not generate a valid target; the settings may leave no playable notes in range',
    )
  }

  private formFor(key: KeySignature): MinorForm {
    const f = this.config.minorForm
    return key.mode === 'major'
      ? 'natural'
      : f === 'either'
        ? pick(this.rng, ['natural', 'harmonic'] as const)
        : f
  }

  private build(key: KeySignature, kind: SingleHandContent): Target | null {
    const { config, rng } = this
    const form = this.formFor(key)
    let pitches: Pitch[]
    let content: Target['content']
    let label: string | undefined

    if (kind === 'note' || kind === 'interval') {
      const degree = randInt(rng, 7)
      const steps = kind === 'interval' ? pick(rng, config.intervalSizes) - 1 : 0
      for (const shift of shuffled(rng, OCTAVE_SHIFTS)) {
        const base = degree + 7 * shift
        let lower = scalePitch(key, base, 4, form)
        let upper = kind === 'interval' ? scalePitch(key, base + steps, 4, form) : null
        if (config.alterations > 0 && rng() < config.alterations) {
          if (upper && rng() < 0.5) upper = alter(upper, rng)
          else lower = alter(lower, rng)
        }
        pitches = upper ? [lower, upper] : [lower]
        content =
          kind === 'interval'
            ? { type: 'interval', quality: intervalName(intervalBetween(lower, upper!)) }
            : { type: 'note' }
        const candidate = this.target(key, pitches, content, label)
        if (validateTarget(candidate, config.constraints).ok) return candidate
      }
      return null
    }

    const size = kind === 'triad' ? 'triad' : 'seventh'
    const degree = 1 + randInt(rng, 7)
    const inversion = config.inversions ? randInt(rng, size === 'triad' ? 3 : 4) : 0
    for (const octave of shuffled(rng, [2, 3, 4, 5, 6])) {
      const chord = diatonicChord(key, degree, size, { inversion, octave, form })
      pitches =
        config.maxChordNotes && config.maxChordNotes < chord.pitches.length
          ? preferredSubset(chord, config.maxChordNotes).map((t) => t.pitch)
          : chord.pitches
      content = { type: kind, quality: chord.quality, inversion, degree }
      label = chord.label
      const candidate = this.target(key, pitches, content, label)
      if (validateTarget(candidate, config.constraints).ok) return candidate
    }
    return null
  }

  private target(
    key: KeySignature,
    pitches: Pitch[],
    content: Target['content'],
    label?: string,
  ): Target {
    const part: HandPart = {
      hand: this.hand,
      clef: clefForHand(this.hand),
      pitches,
      ...(label && { label }),
    }
    return { id: '', key, parts: [part], content }
  }
}
