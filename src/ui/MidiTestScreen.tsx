import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MidiInput, type RequestMidiAccess } from '../audio/inputs/MidiInput'
import { PianoKeyboard, type KeyMark } from '../notation/PianoKeyboard'
import { formatPitch, pitchFromMidi } from '../theory/pitch'

const DEVICE_KEY = 'piano-drill.midi-device'

const noteName = (midi: number) => formatPitch(pitchFromMidi(midi))

function savedDevice(): string | null {
  try {
    return localStorage.getItem(DEVICE_KEY)
  } catch {
    return null
  }
}
function saveDevice(id: string | null): void {
  try {
    if (id === null) localStorage.removeItem(DEVICE_KEY)
    else localStorage.setItem(DEVICE_KEY, id)
  } catch {
    // Not remembered; the choice still applies for this visit.
  }
}

/** What the browser can see of each piano: tells a missing piano from a broken screen. */
function Devices({ input }: { input: MidiInput }) {
  if (input.devices.length === 0) return null
  return (
    <table className="results" aria-label="Devices">
      <thead>
        <tr>
          <th>Device</th>
          <th>State</th>
          <th>Port</th>
        </tr>
      </thead>
      <tbody>
        {input.devices.map((d) => (
          <tr key={d.id}>
            <td>{d.name}</td>
            <td>{d.connected ? 'connected' : 'not connected'}</td>
            <td>{d.connection ?? 'unknown'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Troubleshooting screen for the MIDI input (PD-313): connect to your digital piano, pick it from the list, and watch
 * the keys you hold light up. This is the check that the piano is talking to the browser before using it in a drill.
 */
export function MidiTestScreen({ requestAccess }: { requestAccess?: RequestMidiAccess | null }) {
  const [input] = useState(
    () => new MidiInput(requestAccess === undefined ? {} : { requestAccess }),
  )
  const [, bump] = useState(0)
  const [held, setHeld] = useState<number[]>([])
  const [chosen, setChosen] = useState<string | null>(savedDevice)

  useEffect(() => {
    const offChange = input.onChange(() => bump((x) => x + 1))
    const offUpdate = input.onUpdate((s) => {
      setHeld([...s.activeNotes.keys()])
    })
    return () => {
      offChange()
      offUpdate()
      input.stop()
    }
  }, [input])

  const connect = async () => {
    try {
      await input.start()
      input.select(chosen)
    } catch {
      // The status and message below say what went wrong.
    }
  }
  const disconnect = () => {
    input.stop()
    setHeld([])
  }
  const pick = (value: string) => {
    const id = value === '' ? null : value
    setChosen(id)
    saveDevice(id)
    input.select(id)
  }

  const { status, devices } = input
  const chosenDevice = devices.find((d) => d.id === chosen)
  const message =
    status === 'idle'
      ? 'Not connected. Press Connect, and allow MIDI access if your browser asks.'
      : status === 'connecting'
        ? 'Waiting for the browser… allow MIDI access if it asks.'
        : status === 'ready'
          ? devices.length === 0
            ? 'Connected to the browser, but no MIDI device was found. Plug in or switch on your piano.'
            : chosen && !chosenDevice?.connected
              ? 'Your chosen piano is not connected. Plug it in, or choose "All devices".'
              : 'Listening. Play something on your piano.'
          : input.error
  const marks = new Map<number, KeyMark>(held.map((m) => [m, 'heard']))
  const labels = new Map(held.map((m) => [m, noteName(m)]))

  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>MIDI Test</h1>
      <p className="placeholder">
        Checks that your digital piano is talking to the browser. It needs Chrome, Edge or Opera on
        a computer, with the piano plugged in by USB or paired by Bluetooth.
      </p>

      <p>
        {status === 'ready' ? (
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        ) : (
          <button type="button" onClick={() => void connect()} disabled={status === 'connecting'}>
            Connect
          </button>
        )}
      </p>
      <p role="status" className={status === 'ready' ? undefined : 'midi-problem'}>
        {message}
      </p>

      {status === 'ready' && (
        <p>
          <label>
            Piano{' '}
            <select value={chosen ?? ''} onChange={(e) => pick(e.target.value)}>
              <option value="">All devices</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.connected ? '' : ' (not connected)'}
                </option>
              ))}
              {chosen && !chosenDevice && (
                <option value={chosen}>Saved piano (not connected)</option>
              )}
            </select>
          </label>
        </p>
      )}

      {status === 'ready' && <Devices input={input} />}

      <PianoKeyboard marks={marks} labels={labels} showNames label="Notes you are holding" />
    </>
  )
}
