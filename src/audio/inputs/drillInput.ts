import { MergedInput } from './MergedInput'
import { MidiInput, MidiUnavailableError, type RequestMidiAccess } from './MidiInput'
import type { NoteInput } from './NoteInput'
import { OnScreenKeyboardInput } from './OnScreenKeyboardInput'

/** Where a drill gets its notes: the on-screen piano, or a MIDI piano (the on-screen one still works too). */
export type InputChoice = 'screen' | 'midi'

const CHOICE_KEY = 'piano-drill.input'
const DEVICE_KEY = 'piano-drill.midi-device'

export const NO_PIANO_MESSAGE =
  'No MIDI piano was found. Plug in and switch on your piano, or choose the on-screen piano in Settings.'
export const PIANO_LOST_MESSAGE = 'Your piano was disconnected. Plug it back in, then press Resume.'
export const PIANO_BACK_MESSAGE = 'Your piano is back. Press Resume.'

/** The remembered choice, shared by the Play and Key ID screens. The on-screen piano until you choose otherwise. */
export function loadInputChoice(): InputChoice {
  try {
    return localStorage.getItem(CHOICE_KEY) === 'midi' ? 'midi' : 'screen'
  } catch {
    return 'screen'
  }
}

export function saveInputChoice(choice: InputChoice): void {
  try {
    localStorage.setItem(CHOICE_KEY, choice)
  } catch {
    // Not remembered; the choice still applies for this visit.
  }
}

/** The piano chosen on the MIDI test screen, if any. */
export function loadMidiDevice(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY)
  } catch {
    return null
  }
}

export type DrillInput = {
  /** What the session listens to. */
  input: NoteInput
  /** The on-screen piano: its keys still play, whichever input is chosen. */
  screen: OnScreenKeyboardInput
  /** The MIDI piano, when chosen. */
  midi: MidiInput | null
}

export function createDrillInput(
  choice: InputChoice,
  opts: { requestAccess?: RequestMidiAccess | null } = {},
): DrillInput {
  const screen = new OnScreenKeyboardInput()
  if (choice === 'screen') return { input: screen, screen, midi: null }
  const midi = new MidiInput({
    deviceId: loadMidiDevice(),
    ...(opts.requestAccess === undefined ? {} : { requestAccess: opts.requestAccess }),
  })
  return { input: new MergedInput([midi, screen]), screen, midi }
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
    midi.stop()
    throw new MidiUnavailableError('error', NO_PIANO_MESSAGE)
  }
}
