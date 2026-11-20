import type { MidiDevice } from '../../audio/inputs/MidiInput'
import { midiMessage } from './midiText'
import type { MidiConnection } from './useMidi'

/** Connect when not connected, Disconnect when connected. */
export function MidiConnectButton({ midi }: { midi: MidiConnection }) {
  return midi.status === 'ready' ? (
    <button type="button" onClick={midi.disconnect}>
      Disconnect
    </button>
  ) : (
    <button
      type="button"
      onClick={() => void midi.connect()}
      disabled={midi.status === 'connecting'}
    >
      Connect
    </button>
  )
}

/** What the connection is doing, in words. Highlighted when something is wrong. */
export function MidiStatusLine({ midi }: { midi: MidiConnection }) {
  return (
    <p role="status" className={midi.status === 'ready' ? undefined : 'midi-problem'}>
      {midiMessage(midi)}
    </p>
  )
}

/** Which piano to listen to: all of them, or one. A remembered piano that is not plugged in is still listed. */
export function MidiPianoSelect({
  midi,
  label = 'Piano',
}: {
  midi: MidiConnection
  label?: string
}) {
  const { devices, chosen } = midi
  const chosenDevice = devices.find((d) => d.id === chosen)
  return (
    <label>
      {label}{' '}
      <select value={chosen ?? ''} onChange={(e) => midi.choose(e.target.value || null)}>
        <option value="">All devices</option>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {d.connected ? '' : ' (not connected)'}
          </option>
        ))}
        {chosen && !chosenDevice && <option value={chosen}>Saved piano (not connected)</option>}
      </select>
    </label>
  )
}

/** What the browser can see of each piano: tells a missing piano from a broken screen. */
export function MidiDevicesTable({ devices }: { devices: MidiDevice[] }) {
  if (devices.length === 0) return null
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
        {devices.map((d) => (
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
