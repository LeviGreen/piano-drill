import { Link } from 'react-router'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import {
  MidiConnectButton,
  MidiDevicesTable,
  MidiPianoSelect,
  MidiStatusLine,
} from './midi/MidiControls'
import { MidiKeyboard } from './midi/MidiKeyboard'
import { useHeldNotes } from './midi/useHeldNotes'
import { useMidi } from './midi/useMidi'

/**
 * Troubleshooting screen for the MIDI input (PD-313): connect to your digital piano, pick it from the list, and watch
 * the keys you hold light up. This is the check that the piano is talking to the browser before using it in a drill.
 * It is built from the same parts as the connection strip on the drill screens, and uses the same connection.
 */
export function MidiTestScreen({ requestAccess }: { requestAccess?: RequestMidiAccess | null }) {
  const midi = useMidi(requestAccess)
  const held = useHeldNotes(midi.input)

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
        <MidiConnectButton midi={midi} />
      </p>
      <MidiStatusLine midi={midi} />

      {midi.status === 'ready' && (
        <p>
          <MidiPianoSelect midi={midi} />
        </p>
      )}

      {midi.status === 'ready' && <MidiDevicesTable devices={midi.devices} />}

      <MidiKeyboard held={held} />
    </>
  )
}
