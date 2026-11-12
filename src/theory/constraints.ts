import { formatPitch, sortPitches } from './pitch'
import { ledgerLines } from './staff'
import type { Hand, HandPart, Target } from './target'

export type Constraints = {
  maxNotesPerHand: number
  /** Widest comfortable one-hand stretch in semitones (default 14 = a major 9th). */
  maxSpanSemitones: number
  /** 0 = staff only, 1 = one ledger line, 2 = two, and so on. */
  maxLedgerLines: number
  /** Absolute playable range as MIDI numbers (default C2 to C6: the notes with up to two ledger lines past either end). */
  lowestMidi: number
  highestMidi: number
  /**
   * Muddy-interval rule: adjacent notes whose lower note is below `belowMidi` must be at least
   * `minSemitones` apart (default: nothing narrower than a perfect fifth below C3).
   */
  lowIntervalLimit: { belowMidi: number; minSemitones: number }
  /** Allow the left hand to reach the right hand's register (default false). */
  allowHandCrossing: boolean
}

/**
 * The MVP range, C2 to C6 (MIDI 36 to 84). With two ledger lines allowed, the treble staff reaches up to C6 (on its second
 * ledger line above) and the bass staff down to C2 (on its second ledger line below); the other ends are well inside.
 */
export const RANGE_LOW_MIDI = 36
export const RANGE_HIGH_MIDI = 84

export const DEFAULT_CONSTRAINTS: Constraints = {
  maxNotesPerHand: 5,
  maxSpanSemitones: 14,
  maxLedgerLines: 2,
  lowestMidi: RANGE_LOW_MIDI, // C2, on the second ledger line below the bass staff
  highestMidi: RANGE_HIGH_MIDI, // C6, on the second ledger line above the treble staff
  lowIntervalLimit: { belowMidi: 48, minSemitones: 7 },
  allowHandCrossing: false,
}

export type ViolationCode =
  | 'part-count'
  | 'duplicate-hand'
  | 'empty-part'
  | 'too-many-notes'
  | 'duplicate-pitch'
  | 'span-too-wide'
  | 'ledger-lines'
  | 'out-of-range'
  | 'low-interval'
  | 'hand-crossing'

export type Violation = { code: ViolationCode; message: string; hand?: Hand }
export type ValidationResult = { ok: boolean; reasons: Violation[] }

/** Distance from lowest to highest note in semitones (0 for a single note). */
export function handSpan(part: Pick<HandPart, 'pitches'>): number {
  if (part.pitches.length === 0) return 0
  const midis = part.pitches.map((p) => p.midi)
  return Math.max(...midis) - Math.min(...midis)
}

/** Check one hand's notes in isolation. */
export function validatePart(part: HandPart, c: Constraints = DEFAULT_CONSTRAINTS): Violation[] {
  const out: Violation[] = []
  const add = (code: ViolationCode, message: string) => out.push({ code, message, hand: part.hand })
  const pitches = sortPitches(part.pitches)

  if (pitches.length === 0)
    return [{ code: 'empty-part', message: `${part.hand} has no notes`, hand: part.hand }]
  if (pitches.length > c.maxNotesPerHand) {
    add('too-many-notes', `${part.hand} has ${pitches.length} notes (max ${c.maxNotesPerHand})`)
  }
  if (new Set(pitches.map((p) => p.midi)).size !== pitches.length) {
    add('duplicate-pitch', `${part.hand} repeats a pitch`)
  }
  const span = handSpan({ pitches })
  if (span > c.maxSpanSemitones) {
    add('span-too-wide', `${part.hand} spans ${span} semitones (max ${c.maxSpanSemitones})`)
  }
  for (const p of pitches) {
    if (p.midi < c.lowestMidi || p.midi > c.highestMidi) {
      add('out-of-range', `${formatPitch(p)} is outside the supported range`)
    }
    const n = ledgerLines(p, part.clef)
    if (n > c.maxLedgerLines) {
      add(
        'ledger-lines',
        `${formatPitch(p)} needs ${n} ledger lines in ${part.clef} clef (max ${c.maxLedgerLines})`,
      )
    }
  }
  const { belowMidi, minSemitones } = c.lowIntervalLimit
  for (let i = 0; i + 1 < pitches.length; i++) {
    const [lo, hi] = [pitches[i], pitches[i + 1]]
    if (lo.midi < belowMidi && hi.midi - lo.midi > 0 && hi.midi - lo.midi < minSemitones) {
      add(
        'low-interval',
        `${formatPitch(lo)}–${formatPitch(hi)} is too close together this low (muddy)`,
      )
    }
  }
  return out
}

/** Check a whole candidate target: returns pass/fail with every reason it failed. */
export function validateTarget(
  target: Target,
  c: Constraints = DEFAULT_CONSTRAINTS,
): ValidationResult {
  const reasons: Violation[] = []
  if (target.parts.length < 1 || target.parts.length > 2) {
    reasons.push({
      code: 'part-count',
      message: `a target needs 1 or 2 hand parts, got ${target.parts.length}`,
    })
  }
  if (target.parts.length === 2 && target.parts[0].hand === target.parts[1].hand) {
    reasons.push({ code: 'duplicate-hand', message: 'both parts are for the same hand' })
  }
  for (const part of target.parts) reasons.push(...validatePart(part, c))

  const lh = target.parts.find((p) => p.hand === 'LH')
  const rh = target.parts.find((p) => p.hand === 'RH')
  if (lh && rh && lh.pitches.length > 0 && rh.pitches.length > 0 && !c.allowHandCrossing) {
    const lhTop = Math.max(...lh.pitches.map((p) => p.midi))
    const rhBottom = Math.min(...rh.pitches.map((p) => p.midi))
    if (lhTop >= rhBottom) {
      reasons.push({ code: 'hand-crossing', message: 'left hand reaches or passes the right hand' })
    }
  }
  return { ok: reasons.length === 0, reasons }
}
