import { diatonicChord, type ChordSize, type MinorForm } from './chords'
import { DEFAULT_CONSTRAINTS, validateTarget, type Constraints } from './constraints'
import { targetSignature } from './generator'
import { KeyRotation } from './keyRotation'
import type { KeySignature } from './keys'
import { mulberry32, pick, randInt, shuffled, type Rng } from './random'
import type { HandPart, Target } from './target'
import { buildVoicing, VOICING_TEMPLATES, type VoicingTemplate } from './voicing'

/** Settings for targets played with both hands at once (design §4.3). */
export type TwoHandConfig = {
  keys: KeySignature[]
  /** Voicings this level allows; one is picked per target. */
  templates: VoicingTemplate[]
  chordSizes: ChordSize[]
  inversions: boolean
  minorForm: MinorForm | 'either'
  /** Allowed number of notes in each hand. */
  lhNotes: number[]
  rhNotes: number[]
  maxSameKeyRun: number
  constraints: Constraints
}

export const DEFAULT_TWO_HAND_CONFIG: Omit<TwoHandConfig, 'keys'> = {
  templates: VOICING_TEMPLATES,
  chordSizes: ['triad'],
  inversions: true,
  minorForm: 'natural',
  lhNotes: [1, 2],
  rhNotes: [1, 2, 3, 4],
  maxSameKeyRun: 2,
  constraints: DEFAULT_CONSTRAINTS,
}

/**
 * Generates two-hand targets that read as ONE diatonic chord: it picks a chord, splits all of its tones
 * between the hands with a voicing template, and keeps only results that are playable (left hand below
 * the right, within each hand's reach and staff, no muddy low intervals).
 */
export class TwoHandGenerator {
  readonly config: TwoHandConfig
  private readonly rng: Rng
  private readonly rotation: KeyRotation
  private count = 0
  private lastSignature = ''

  constructor(config: TwoHandConfig, seed = 1) {
    if (config.keys.length === 0) throw new RangeError('config.keys must not be empty')
    if (config.templates.length === 0) throw new RangeError('config.templates must not be empty')
    if (config.chordSizes.length === 0) throw new RangeError('config.chordSizes must not be empty')
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
      'Could not generate a valid two-hand target; the settings may leave no playable voicings in range',
    )
  }

  private build(key: KeySignature): Target | null {
    const { config, rng } = this
    const size = pick(rng, config.chordSizes)
    const templates = config.templates.filter((t) => t.sizes.includes(size))
    if (templates.length === 0) return null
    const template = pick(rng, templates)
    const degree = 1 + randInt(rng, 7)
    const inversion = config.inversions ? randInt(rng, size === 'triad' ? 3 : 4) : 0
    const form: MinorForm =
      key.mode === 'major'
        ? 'natural'
        : config.minorForm === 'either'
          ? pick(rng, ['natural', 'harmonic'] as const)
          : config.minorForm

    for (const octave of shuffled(rng, [2, 3, 4, 5])) {
      for (let tries = 0; tries < 4; tries++) {
        const chord = diatonicChord(key, degree, size, { inversion, octave, form })
        const voicing = buildVoicing(template, chord, rng)
        if (!voicing) continue
        if (
          !config.lhNotes.includes(voicing.lh.length) ||
          !config.rhNotes.includes(voicing.rh.length)
        )
          continue
        const parts: HandPart[] = [
          { hand: 'LH', clef: 'bass', pitches: voicing.lh, label: chord.label },
          { hand: 'RH', clef: 'treble', pitches: voicing.rh, label: chord.label },
        ]
        const target: Target = {
          id: '',
          key,
          parts,
          content: { type: size, quality: chord.quality, inversion, degree, voicing: template.id },
        }
        if (validateTarget(target, config.constraints).ok) return target
      }
    }
    return null
  }
}
