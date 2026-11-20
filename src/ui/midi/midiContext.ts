import { createContext } from 'react'
import type { MidiInput } from '../../audio/inputs/MidiInput'

/** The app's one MIDI connection, shared by every screen (the Settings page and the two drill screens). */
export const MidiContext = createContext<MidiInput | null>(null)
