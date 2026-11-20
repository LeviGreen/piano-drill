import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { createMidiInput, pianoConnected, saveMidiDevice } from '../../audio/inputs/drillInput'
import type {
  MidiDevice,
  MidiInput,
  MidiStatus,
  RequestMidiAccess,
} from '../../audio/inputs/MidiInput'
import { MidiContext } from './midiContext'

/** What a screen shows and does about the MIDI piano. */
export type MidiConnection = {
  input: MidiInput
  status: MidiStatus
  /** A sentence about what went wrong, when the status is denied, unsupported or error. */
  error: string
  devices: MidiDevice[]
  /** The id of the piano chosen to listen to, or null for all of them. */
  chosen: string | null
  /** A piano we are listening to is plugged in. */
  hasPiano: boolean
  connect: () => Promise<void>
  disconnect: () => void
  /** Start over: let go, ask the browser again, and look for the piano. */
  reconnect: () => Promise<void>
  /** Listen to one piano (by id) or to all of them (null), and remember the choice. */
  choose: (id: string | null) => void
}

/** Changes only when something a screen shows changes (not on every note), so screens do not redraw on each key. */
const stateKey = (m: MidiInput) =>
  JSON.stringify([m.status, m.error, m.devices, m.selectedDeviceId])

/**
 * The MIDI connection: the app's shared one (from `MidiProvider`) or, where there is none or a test passes its own
 * `requestAccess`, one of the screen's own that is stopped when the screen goes away.
 */
export function useMidi(requestAccess?: RequestMidiAccess | null): MidiConnection {
  const shared = useContext(MidiContext)
  const [own] = useState(() =>
    shared && requestAccess === undefined ? null : createMidiInput(requestAccess),
  )
  const input = (own ?? shared)!
  useEffect(() => (own ? () => own.stop() : undefined), [own])

  const subscribe = useCallback((cb: () => void) => input.onChange(cb), [input])
  useSyncExternalStore(subscribe, () => stateKey(input))

  const connect = useCallback(async () => {
    try {
      await input.start()
    } catch {
      // The status says what went wrong.
    }
  }, [input])
  const disconnect = useCallback(() => input.stop(), [input])
  const reconnect = useCallback(async () => {
    input.stop()
    await connect()
  }, [input, connect])
  const choose = useCallback(
    (id: string | null) => {
      saveMidiDevice(id)
      input.select(id)
    },
    [input],
  )

  return {
    input,
    status: input.status,
    error: input.error,
    devices: input.devices,
    chosen: input.selectedDeviceId,
    hasPiano: pianoConnected(input),
    connect,
    disconnect,
    reconnect,
    choose,
  }
}
