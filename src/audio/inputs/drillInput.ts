import { loadPref, PREF_KEYS, savePref } from '../../storage/prefs'
import { BorrowedInput } from './BorrowedInput'
import { MergedInput } from './MergedInput'
import { MidiInput, MidiUnavailableError, type RequestMidiAccess } from './MidiInput'
import type { NoteInput } from './NoteInput'
import { OnScreenKeyboardInput } from './OnScreenKeyboardInput'

/** Where a drill gets its notes: the on-screen piano, or a MIDI piano (the on-screen one still works too). */
export type InputChoice = 'screen' | 'midi'

export const NO_PIANO_MESSAGE =
  'No MIDI piano was found. Plug in and switch on your piano, or choose the on-screen piano in Settings.'
export const PIANO_LOST_MESSAGE = 'Your piano was disconnected. Plug it back in, then press Resume.'
export const PIANO_BACK_MESSAGE = 'Your piano is back. Press Resume.'

/** The remembered choice, shared by the Sight-Read and Key Signatures screens. The on-screen piano until you choose otherwise. */
export function loadInputChoice(): InputChoice {
  return loadPref(PREF_KEYS.inputChoice) === 'midi' ? 'midi' : 'screen'
}

export function saveInputChoice(choice: InputChoice): void {
  savePref(PREF_KEYS.inputChoice, choice)
}

/** The piano chosen on the MIDI test screen, if any. */
export function loadMidiDevice(): string | null {
  return loadPref(PREF_KEYS.midiDevice)
}

/** Remember the piano chosen on the MIDI test screen; null goes back to listening to all of them. */
export function saveMidiDevice(id: string | null): void {
  savePref(PREF_KEYS.midiDevice, id)
}

export type DrillInput = {
  /** What the session listens to. */
  input: NoteInput
  /** The on-screen piano: its keys still play, whichever input is chosen. */
  screen: OnScreenKeyboardInput
  /** The MIDI piano's connection, when chosen. It belongs to the app, not to the session. */
  midi: MidiInput | null
  /** The MIDI piano's notes, lent to the session: stopping the session leaves the connection open. */
  midiNotes: NoteInput | null
}

/** The app's MIDI connection: remembers the piano chosen last time, and is made once and shared. */
export function createMidiInput(requestAccess?: RequestMidiAccess | null): MidiInput {
  return new MidiInput({
    deviceId: loadMidiDevice(),
    ...(requestAccess === undefined ? {} : { requestAccess }),
  })
}

export function createDrillInput(
  choice: InputChoice,
  /** The MIDI connection to use when the piano is chosen. */
  midi: MidiInput,
): DrillInput {
  const screen = new OnScreenKeyboardInput()
  if (choice === 'screen') return { input: screen, screen, midi: null, midiNotes: null }
  const midiNotes = new BorrowedInput(midi)
  return { input: new MergedInput([midiNotes, screen]), screen, midi, midiNotes }
}

/** Is a piano we are listening to plugged in? */
export function pianoConnected(midi: MidiInput): boolean {
  const chosen = midi.selectedDeviceId
  return midi.devices.some((d) => d.connected && (chosen === null || d.id === chosen))
}

/**
 * Connect to MIDI before a session starts, so that a missing piano, a blocked permission or a browser without MIDI is
 * reported at once, in words, instead of a session that nothing can answer. Throws a `MidiUnavailableError`.
 */
export async function connectMidi(midi: MidiInput): Promise<void> {
  await midi.start()
  if (!pianoConnected(midi)) {
    // The connection stays up and keeps listening, so a piano switched on a moment later is noticed.
    throw new MidiUnavailableError('error', NO_PIANO_MESSAGE)
  }
}
