import { useEffect, useState, type ReactNode } from 'react'
import { createMidiInput } from '../../audio/inputs/drillInput'
import type { RequestMidiAccess } from '../../audio/inputs/MidiInput'
import { MidiContext } from './midiContext'

/**
 * Holds the app's one MIDI connection for as long as the app is open, so that connecting on one screen is connecting on
 * all of them, and a connection made once stays up as you move around.
 */
export function MidiProvider({
  requestAccess,
  children,
}: {
  /** For tests: stands in for the browser's MIDI request. */
  requestAccess?: RequestMidiAccess | null
  children: ReactNode
}) {
  const [input] = useState(() => createMidiInput(requestAccess))
  useEffect(() => () => input.stop(), [input])
  return <MidiContext value={input}>{children}</MidiContext>
}
