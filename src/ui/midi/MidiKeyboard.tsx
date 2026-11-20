import { PianoKeyboard, type KeyMark } from '../../notation/PianoKeyboard'
import { formatPitch, pitchFromMidi } from '../../theory/pitch'

/** A keyboard that lights up the keys held, with their names. */
export function MidiKeyboard({ held }: { held: number[] }) {
  const marks = new Map<number, KeyMark>(held.map((m) => [m, 'heard']))
  const labels = new Map(held.map((m) => [m, formatPitch(pitchFromMidi(m))]))
  return <PianoKeyboard marks={marks} labels={labels} showNames label="Notes you are holding" />
}
