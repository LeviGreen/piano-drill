import type { MidiAccessLike, MidiPortLike } from '../audio/inputs/MidiInput'

/** A fake MIDI input port, like the browser's `MIDIInput`, that a test can play notes into. */
export class FakePort implements MidiPortLike {
  onmidimessage: MidiPortLike['onmidimessage'] = null
  state = 'connected'
  readonly id: string
  readonly name: string | null
  constructor(id: string, name: string | null = id) {
    this.id = id
    this.name = name
  }

  /** A raw MIDI message arriving at time `t` (ms on the performance clock). */
  send(bytes: number[], t: number): void {
    this.onmidimessage?.({ data: new Uint8Array(bytes), timeStamp: t })
  }
  noteOn(midi: number, t: number, velocity = 90, channel = 0): void {
    this.send([0x90 | channel, midi, velocity], t)
  }
  noteOff(midi: number, t: number, channel = 0): void {
    this.send([0x80 | channel, midi, 0], t)
  }
  pedal(down: boolean, t: number): void {
    this.send([0xb0, 64, down ? 127 : 0], t)
  }
}

/** A fake `MIDIAccess` with ports that can be plugged in and out. */
export class FakeMidiAccess implements MidiAccessLike {
  onstatechange: ((event: unknown) => void) | null = null
  private ports = new Map<string, FakePort>()
  readonly inputs = { forEach: (cb: (port: FakePort) => void) => this.ports.forEach((p) => cb(p)) }

  constructor(...ports: FakePort[]) {
    for (const p of ports) this.ports.set(p.id, p)
  }
  plugIn(port: FakePort): void {
    port.state = 'connected'
    this.ports.set(port.id, port)
    this.onstatechange?.({ port })
  }
  unplug(port: FakePort): void {
    port.state = 'disconnected' // the browser keeps a disconnected port in the list
    this.onstatechange?.({ port })
  }
}
