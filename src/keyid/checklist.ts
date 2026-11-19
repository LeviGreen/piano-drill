import type { KeyIdQuestion } from './questions'
import { keySignature } from '../theory/keys'
import { pitch } from '../theory/pitch'

/**
 * Answering a key-ID question by playing (PD-315): instead of naming the key, the player plays a checklist on a MIDI
 * piano, in any order: the key's scale up, the scale down, the tonic chord and its two inversions. Every row ticks off by itself and a slip costs only the row it
 * was in. A hand cannot be told from a MIDI message, so the hand is enforced by register: everything is played on the
 * clef's side of middle C (treble: at or above it; bass: below it), and notes on the other side are ignored, so the
 * other hand is free to do anything.
 */

/** Seconds added to a question's time limit when it is answered by playing (the checklist is a lot to play). */
export const PLAY_GRACE_SECONDS = 25

/** Middle C: treble starts at or above it, bass below it. */
const MIDDLE_C = 60

/** Semitones above the tonic, going up to the octave. Minor is natural minor, so it follows the key signature. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11, 12]
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 12]

export type RowId = 'up' | 'down' | 'root' | 'first' | 'second'

export type ChecklistRow = {
  id: RowId
  /** Generic on purpose: it must not say which key it is. */
  label: string
  done: boolean
  /** For a row played one note at a time: how many are done, of how many. 0 / 0 for a chord. */
  progress: number
  total: number
}

/** The hand that plays a question. */
export const handFor = (q: KeyIdQuestion): 'left' | 'right' =>
  q.clef === 'bass' ? 'left' : 'right'

/** Is this note on the side of middle C that the question's clef is played on? */
export const onClefSide = (q: Pick<KeyIdQuestion, 'clef'>, midi: number): boolean =>
  q.clef === 'treble' ? midi >= MIDDLE_C : midi < MIDDLE_C

/** The scale as first shown (and revealed after a miss): the tonic nearest middle C on the clef's side, up to the octave. */
export function scaleToShow(q: KeyIdQuestion): number[] {
  const key = keySignature(q.answer.accidentals, q.answer.mode)
  const pc = pitch(key.tonic.letter, key.tonic.accidental, 4).midi % 12
  const tonic = q.clef === 'treble' ? MIDDLE_C + pc : MIDDLE_C - 12 + pc
  return (key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS).map((s) => tonic + s)
}

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** One question's checklist: feed it every note struck and the keys held, and it says what is done. */
export class Checklist {
  private readonly q: KeyIdQuestion
  private readonly steps: number[]
  private readonly tonicPc: number
  private readonly keyClasses: Set<number>
  private readonly thirdSemitones: number
  private up = { tonic: null as number | null, n: 0 }
  private down = { base: null as number | null, n: 0 }
  private chords = { root: false, first: false, second: false }

  constructor(q: KeyIdQuestion) {
    this.q = q
    const key = keySignature(q.answer.accidentals, q.answer.mode)
    this.steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS
    this.tonicPc = pitch(key.tonic.letter, key.tonic.accidental, 4).midi % 12
    this.keyClasses = new Set(this.steps.map((s) => mod12(this.tonicPc + s)))
    this.thirdSemitones = key.mode === 'major' ? 4 : 3
  }

  rows(): ChecklistRow[] {
    const rows: ChecklistRow[] = [
      {
        id: 'up',
        label: 'Scale up',
        done: this.up.n === 8,
        progress: this.up.n,
        total: 8,
      },
      {
        id: 'down',
        label: 'Scale down',
        done: this.down.n === 8,
        progress: this.down.n,
        total: 8,
      },
      { id: 'root', label: 'Tonic chord', done: this.chords.root, progress: 0, total: 0 },
      { id: 'first', label: 'First inversion', done: this.chords.first, progress: 0, total: 0 },
      { id: 'second', label: 'Second inversion', done: this.chords.second, progress: 0, total: 0 },
    ]
    return rows
  }

  get complete(): boolean {
    return this.rows().every((r) => r.done)
  }

  /** A note that is on the clef's side of middle C but not in the key: the only kind that counts as wrong (it costs points). */
  isWrongNote(midi: number): boolean {
    return onClefSide(this.q, midi) && !this.keyClasses.has(mod12(midi))
  }

  /**
   * A note was struck. `held` are the other keys down at that moment. Playing smoothly overlaps notes (the next key goes
   * down before the last one is up), so a note that is exactly the next one a row expects always counts. Any other note
   * struck while a key on this side is held belongs to a chord: it neither starts nor resets a row.
   */
  strike(midi: number, held: readonly number[]): void {
    const chorded = held.some((m) => m !== midi && onClefSide(this.q, m))
    const upBefore = this.up.n
    const downBefore = this.down.n
    this.strikeUp(midi, chorded)
    this.strikeDown(midi, chorded)
    // A turning note counts for both rows: the top note that finishes "Scale up" also starts "Scale down", and the bottom
    // note that finishes "Scale down" also starts "Scale up". It need not be struck twice, though striking it again is fine.
    // (When played smoothly the last key is still held, which would otherwise read as a chord.)
    if (upBefore < 8 && this.up.n === 8 && this.down.n !== 8) {
      this.down.base = midi - 12
      this.down.n = 1
    } else if (downBefore < 8 && this.down.n === 8 && this.up.n !== 8) {
      this.up.tonic = midi
      this.up.n = 1
    }
  }

  private startsScale(midi: number, lowest = midi): boolean {
    return mod12(midi) === this.tonicPc && onClefSide(this.q, lowest)
  }

  private strikeUp(midi: number, chorded: boolean) {
    const u = this.up
    if (u.n === 8) return
    if (u.tonic !== null && midi === u.tonic + this.steps[u.n]) {
      u.n++
    } else if (chorded) {
      return
    } else if (this.startsScale(midi)) {
      u.tonic = midi
      u.n = 1
    } else if (onClefSide(this.q, midi)) {
      u.tonic = null
      u.n = 0
    }
  }

  /** Going down starts on the octave; the lowest note, the tonic an octave below, is the one on the clef's side. */
  private strikeDown(midi: number, chorded: boolean) {
    const d = this.down
    if (d.n === 8) return
    if (d.base !== null && midi === d.base + this.steps[7 - d.n]) {
      d.n++
    } else if (chorded) {
      return
    } else if (this.startsScale(midi, midi - 12)) {
      d.base = midi - 12
      d.n = 1
    } else if (onClefSide(this.q, midi)) {
      d.base = null
      d.n = 0
    }
  }

  /**
   * The keys now held. The lowest one on the clef's side of middle C is the bottom of a chord (if none is on that side,
   * as when a bass inversion climbs past middle C, the lowest one held): it and whatever is held within an octave above
   * it must be exactly the three notes of the tonic chord, and the bottom one says which inversion it is. The chord
   * counts when the root-position chord it comes from starts on the clef's side, so in the bass a rising run of root
   * position and inversions still counts when the inversions climb above middle C.
   */
  hold(held: readonly number[]): void {
    const side = held.filter((m) => onClefSide(this.q, m))
    const pool = side.length > 0 ? side : held
    if (pool.length === 0) return
    const bottom = Math.min(...pool)
    const chord = held.filter((m) => m >= bottom && m <= bottom + 12)
    if (chord.length !== 3) return
    const want = new Set([0, this.thirdSemitones, 7])
    const have = new Set(chord.map((m) => mod12(m - this.tonicPc)))
    if (have.size !== 3 || ![...have].every((r) => want.has(r))) return
    const lowest = mod12(bottom - this.tonicPc)
    if (!onClefSide(this.q, bottom - lowest)) return
    if (lowest === 0) this.chords.root = true
    else if (lowest === this.thirdSemitones) this.chords.first = true
    else this.chords.second = true
  }
}
