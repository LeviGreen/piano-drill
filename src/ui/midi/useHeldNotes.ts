import { useEffect, useState } from 'react'
import type { MidiInput } from '../../audio/inputs/MidiInput'

/** The MIDI numbers of the keys held on the piano right now. */
export function useHeldNotes(input: MidiInput): number[] {
  const [held, setHeld] = useState<number[]>([])
  useEffect(() => {
    return input.onUpdate((s) => setHeld([...s.activeNotes]))
  }, [input])
  return held
}
