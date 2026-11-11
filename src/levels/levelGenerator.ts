import {
  DEFAULT_SINGLE_HAND_CONFIG,
  keysUpTo,
  TargetGenerator,
  type NotesPerHand,
  type SingleHandConfig,
} from '../theory/generator'
import type { KeySignature } from '../theory/keys'
import { mulberry32, pick } from '../theory/random'
import type { Hand, Target } from '../theory/target'
import { DEFAULT_TWO_HAND_CONFIG, TwoHandGenerator, type TwoHandConfig } from '../theory/twoHand'
import { constraintsFor, parseKeyName, type DifficultySettings } from './settings'

/** The keys a level draws from: an explicit list, or everything up to a number of sharps/flats. */
export function keysFor(s: DifficultySettings): KeySignature[] {
  if (s.keys.explicit) return s.keys.explicit.map((n) => parseKeyName(n)!)
  return keysUpTo(
    s.keys.maxAccidentals,
    s.keys.modes === 'both' ? ['major', 'minor'] : [s.keys.modes],
  )
}

/** Turn validated settings into the one-hand and two-hand generator configurations (null when not used). */
export function toGeneratorConfigs(s: DifficultySettings): {
  single: SingleHandConfig | null
  two: TwoHandConfig | null
} {
  const keys = keysFor(s)
  const constraints = constraintsFor(s)
  const hands = s.hands.filter((h): h is Hand => h !== 'both')
  const single: SingleHandConfig | null =
    hands.length > 0
      ? {
          ...DEFAULT_SINGLE_HAND_CONFIG,
          hands,
          notesPerHand: s.notesPerHand as NotesPerHand[],
          keys,
          intervalSizes: s.intervalSizes,
          inversions: s.inversions,
          alterations: s.chromaticNotes === 'occasional' ? 0.2 : 0,
          minorForm: 'either',
          constraints,
        }
      : null
  const two: TwoHandConfig | null = s.hands.includes('both')
    ? {
        ...DEFAULT_TWO_HAND_CONFIG,
        keys,
        notesPerHand: s.notesPerHand as NotesPerHand[],
        inversions: s.inversions,
        minorForm: 'either',
        constraints,
      }
    : null
  return { single, two }
}

export type LevelGenerator = { settings: DifficultySettings; next(): Target }

/** Generate targets for a level: when several hand modes are allowed, one is picked at random per target. */
export function createLevelGenerator(settings: DifficultySettings, seed = 1): LevelGenerator {
  const { single, two } = toGeneratorConfigs(settings)
  const gens: { next(): Target }[] = []
  if (single) gens.push(new TargetGenerator(single, seed))
  if (two) gens.push(new TwoHandGenerator(two, seed + 1))
  const rng = mulberry32(seed + 2)
  return { settings, next: () => pick(rng, gens).next() }
}
