import type { KeyIdQuestion } from './questions'
import { FLAT_ORDER, keySignature, SHARP_ORDER } from '../theory/keys'
import { pitch } from '../theory/pitch'

/**
 * Answering a key-ID question by playing (PD-315): instead of naming the key, the player plays a checklist on a MIDI
 * piano, in any order: the key's scale up, the scale down, the tonic chord and its two inversions, and the sharps or
 * flats of the signature in the order they are written. Every row ticks off by itself and a slip costs only the row it
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

export type RowId = 'up' | 'down' | 'root' | 'first' | 'second' | 'accidentals'

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

/** The pitch classes (0..11) of the signature's sharps or flats, in the order they are written on the staff. */
function accidentalClasses(accidentals: number): number[] {
  const order = accidentals > 0 ? SHARP_ORDER : FLAT_ORDER
  const acc = accidentals > 0 ? 1 : -1
  return order.slice(0, Math.abs(accidentals)).map((l) => pitch(l, acc, 4).midi % 12)
}

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** One question's checklist: feed it every note struck and the keys held, and it says what is done. */
export class Checklist {
  private readonly q: KeyIdQuestion
  private readonly steps: number[]
  private readonly tonicPc: number
  private readonly keyClasses: Set<number>
  private readonly accClasses: number[]
  private readonly thirdSemitones: number
  private up = { tonic: null as number | null, n: 0 }
  private down = { base: null as number | null, n: 0 }
  private acc = { n: 0 }
  private chords = { root: false, first: false, second: false }

  constructor(q: KeyIdQuestion) {
    this.q = q
    const key = keySignature(q.answer.accidentals, q.answer.mode)
    this.steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS
    this.tonicPc = pitch(key.tonic.letter, key.tonic.accidental, 4).midi % 12
    this.keyClasses = new Set(this.steps.map((s) => mod12(this.tonicPc + s)))
    this.accClasses = accidentalClasses(q.answer.accidentals)
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
    if (this.accClasses.length > 0)
      rows.push({
        id: 'accidentals',
        label: this.q.answer.accidentals > 0 ? 'Sharps in order' : 'Flats in order',
        done: this.acc.n === this.accClasses.length,
        progress: this.acc.n,
        total: this.accClasses.length,
      })
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
   * A note was struck. `held` are the other keys down at that moment: a note struck while another key on this side is
   * held belongs to a chord, so the scales and the sharps/flats row do not see it.
   */
  strike(midi: number, held: readonly number[]): void {
    if (held.some((m) => m !== midi && onClefSide(this.q, m))) return
    this.strikeUp(midi)
    this.strikeDown(midi)
    this.strikeAccidental(midi)
  }

  private startsScale(midi: number, lowest = midi): boolean {
    return mod12(midi) === this.tonicPc && onClefSide(this.q, lowest)
  }

  private strikeUp(midi: number) {
    const u = this.up
    if (u.n === 8) return
    if (u.tonic !== null && midi === u.tonic + this.steps[u.n]) {
      u.n++
    } else if (this.startsScale(midi)) {
      u.tonic = midi
      u.n = 1
    } else if (onClefSide(this.q, midi)) {
      u.tonic = null
      u.n = 0
    }
  }

  /** Going down starts on the octave; the lowest note, the tonic an octave below, is the one on the clef's side. */
  private strikeDown(midi: number) {
    const d = this.down
    if (d.n === 8) return
    if (d.base !== null && midi === d.base + this.steps[7 - d.n]) {
      d.n++
    } else if (this.startsScale(midi, midi - 12)) {
      d.base = midi - 12
      d.n = 1
    } else if (onClefSide(this.q, midi)) {
      d.base = null
      d.n = 0
    }
  }

  private strikeAccidental(midi: number) {
    const a = this.acc
    const list = this.accClasses
    if (list.length === 0 || a.n === list.length || !onClefSide(this.q, midi)) return
    const pc = mod12(midi)
    if (pc === list[a.n]) a.n++
    else a.n = pc === list[0] ? 1 : 0
  }

  /**
   * The keys now held. The lowest one on the clef's side anchors a chord: it and whatever is held within an octave above
   * it must be exactly the three notes of the tonic chord, and the lowest decides which inversion it is.
   */
  hold(held: readonly number[]): void {
    const side = held.filter((m) => onClefSide(this.q, m))
    if (side.length === 0) return
    const bass = Math.min(...side)
    const chord = held.filter((m) => m >= bass && m <= bass + 12)
    if (chord.length !== 3) return
    const want = new Set([0, this.thirdSemitones, 7])
    const have = new Set(chord.map((m) => mod12(m - this.tonicPc)))
    if (have.size !== 3 || ![...have].every((r) => want.has(r))) return
    const lowest = mod12(bass - this.tonicPc)
    if (lowest === 0) this.chords.root = true
    else if (lowest === this.thirdSemitones) this.chords.first = true
    else this.chords.second = true
  }
}
