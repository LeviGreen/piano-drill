import type { MidiConnection } from './useMidi'

/** What the connection is doing, in words, for the MIDI Test page. */
export function midiMessage({ status, devices, chosen, error }: MidiConnection): string {
  if (status === 'idle')
    return 'Not connected. Press Connect, and allow MIDI access if your browser asks.'
  if (status === 'connecting') return 'Waiting for the browser… allow MIDI access if it asks.'
  if (status !== 'ready') return error
  if (devices.length === 0)
    return 'Connected to the browser, but no MIDI device was found. Plug in or switch on your piano.'
  const chosenDevice = devices.find((d) => d.id === chosen)
  if (chosen && !chosenDevice?.connected)
    return 'Your chosen piano is not connected. Plug it in, or choose "All devices".'
  return 'Listening. Play something on your piano.'
}
