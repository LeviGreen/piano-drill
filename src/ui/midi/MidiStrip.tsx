import type { MidiConnection } from './useMidi'

/** One short line about the connection, for the narrow strip on a drill screen. */
function summary(m: MidiConnection): string {
  switch (m.status) {
    case 'idle':
      return 'Piano: not connected'
    case 'connecting':
      return 'Piano: connecting…'
    case 'unsupported':
      return "Piano: this browser can't read MIDI"
    case 'denied':
      return 'Piano: MIDI access is blocked'
    case 'error':
      return 'Piano: MIDI could not start'
    default: {
      const heard = m.devices.filter((d) => d.connected && (m.chosen === null || d.id === m.chosen))
      if (heard.length > 0) return `Piano: ${heard.map((d) => d.name).join(', ')}`
      return m.chosen ? 'Piano: the chosen piano is not connected' : 'Piano: none found'
    }
  }
}

/**
 * The MIDI piano's connection on a drill screen, in one line: whether it is connected, a button to connect or start
 * over, and (only when there is more than one) a way to pick the piano. Built from the same parts as the MIDI Test page.
 */
export function MidiStrip({ midi }: { midi: MidiConnection }) {
  const connected = midi.status === 'ready' && midi.hasPiano
  const connectable = connected || midi.status === 'ready' ? 'Reconnect' : 'Connect'
  const several = midi.status === 'ready' && midi.devices.filter((d) => d.connected).length > 1
  return (
    <div className="midi-strip" aria-label="MIDI piano">
      <span
        className={`midi-strip-text${connected ? '' : ' midi-problem'}`}
        title={midi.error || undefined}
      >
        {summary(midi)}
      </span>
      {several && (
        <select
          aria-label="Piano"
          value={midi.chosen ?? ''}
          onChange={(e) => midi.choose(e.target.value || null)}
        >
          <option value="">All</option>
          {midi.devices
            .filter((d) => d.connected)
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
        </select>
      )}
      <button
        type="button"
        onClick={() => void (midi.status === 'ready' ? midi.reconnect() : midi.connect())}
        disabled={midi.status === 'connecting'}
      >
        {connectable}
      </button>
    </div>
  )
}
