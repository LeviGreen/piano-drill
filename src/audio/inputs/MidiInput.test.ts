import { describe, expect, it } from 'vitest'
import { FakeMidiAccess, FakePort } from '../../test-utils/fakeMidi'
import { describeMidiMessage, MidiInput, MidiUnavailableError, parseMidiMessage } from './MidiInput'
import type { NoteInputState } from './NoteInput'

async function rig(...ports: FakePort[]) {
  const access = new FakeMidiAccess(...ports)
  const input = new MidiInput({ requestAccess: async () => access, now: () => 5 })
  const states: NoteInputState[] = []
  input.onUpdate((s) => states.push(s))
  await input.start()
  return { access, input, states, last: () => states.at(-1)! }
}
const held = (s: NoteInputState) => [...s.activeNotes.keys()].sort((a, b) => a - b)

describe('reading a MIDI message', () => {
  it('note-on with a velocity is a note-on, on any channel', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({ type: 'on', midi: 60, velocity: 100 })
    expect(parseMidiMessage([0x9f, 72, 1])).toEqual({ type: 'on', midi: 72, velocity: 1 })
  })

  it('note-on with velocity 0 is a note-off, and so is a note-off message', () => {
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({ type: 'off', midi: 60 })
    expect(parseMidiMessage([0x80, 60, 64])).toEqual({ type: 'off', midi: 60 })
    expect(parseMidiMessage([0x83, 61, 0])).toEqual({ type: 'off', midi: 61 })
  })

  it('the sustain pedal and other controllers, pitch bend, aftertouch and clock are ignored', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toBeNull() // sustain pedal
    expect(parseMidiMessage([0xb0, 7, 100])).toBeNull() // volume
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull() // pitch bend
    expect(parseMidiMessage([0xd0, 50])).toBeNull() // channel pressure
    expect(parseMidiMessage([0xfe])).toBeNull() // active sensing
    expect(parseMidiMessage([0xf8])).toBeNull() // clock
  })

  it('the two "all notes off" messages release everything', () => {
    expect(parseMidiMessage([0xb0, 123, 0])).toEqual({ type: 'allOff' })
    expect(parseMidiMessage([0xb2, 120, 0])).toEqual({ type: 'allOff' })
  })

  it('anything empty or too short is ignored', () => {
    expect(parseMidiMessage(null)).toBeNull()
    expect(parseMidiMessage([])).toBeNull()
    expect(parseMidiMessage([0x90])).toBeNull()
    expect(parseMidiMessage([0x90, 60])).toBeNull() // a note-on with no velocity
  })
})

describe('playing notes', () => {
  it('a note-on is an onset with the note and the time the message carried, and the key is held', async () => {
    const piano = new FakePort('p', 'Piano')
    const { states, last } = await rig(piano)
    piano.noteOn(60, 1234.5, 127)
    expect(states).toHaveLength(1)
    expect(last().onsets).toEqual([{ midi: 60, t: 1234.5, confidence: 1 }])
    expect(last().t).toBe(1234.5)
    expect(held(last())).toEqual([60])
  })

  it('velocity becomes the confidence, between 0 and 1', async () => {
    const piano = new FakePort('p')
    const { last } = await rig(piano)
    piano.noteOn(60, 1, 64)
    expect(last().onsets[0].confidence).toBeCloseTo(64 / 127)
  })

  it('a chord holds all its notes, and each note-off releases only its own', async () => {
    const piano = new FakePort('p')
    const { last, states } = await rig(piano)
    for (const m of [60, 64, 67]) piano.noteOn(m, 10)
    expect(held(last())).toEqual([60, 64, 67])
    piano.noteOff(64, 20)
    expect(held(last())).toEqual([60, 67])
    expect(last().onsets).toEqual([]) // a release is not an onset
    expect(states.filter((s) => s.onsets.length > 0)).toHaveLength(3)
  })

  it('note-on with velocity 0 releases the note', async () => {
    const piano = new FakePort('p')
    const { last } = await rig(piano)
    piano.noteOn(60, 1)
    piano.send([0x90, 60, 0], 2)
    expect(held(last())).toEqual([])
  })

  it('the sustain pedal does nothing, and a key released with the pedal down is still released', async () => {
    const piano = new FakePort('p')
    const { states, last } = await rig(piano)
    piano.noteOn(60, 1)
    const count = states.length
    piano.pedal(true, 2)
    piano.pedal(false, 3)
    expect(states).toHaveLength(count) // not even an update
    piano.pedal(true, 4)
    piano.noteOff(60, 5)
    expect(held(last())).toEqual([])
  })

  it('"all notes off" clears held notes, and does nothing when nothing is held', async () => {
    const piano = new FakePort('p')
    const { states, last } = await rig(piano)
    piano.send([0xb0, 123, 0], 1)
    expect(states).toHaveLength(0)
    piano.noteOn(60, 2)
    piano.noteOn(64, 3)
    piano.send([0xb0, 123, 0], 4)
    expect(held(last())).toEqual([])
  })

  it('a release for a note that is not held is not an update', async () => {
    const piano = new FakePort('p')
    const { states } = await rig(piano)
    piano.noteOff(60, 1)
    expect(states).toHaveLength(0)
  })

  it('uses the current time for a message that has no timestamp', async () => {
    const piano = new FakePort('p')
    const { last } = await rig(piano)
    piano.noteOn(60, 0)
    expect(last().onsets[0].t).toBe(5) // the rig's clock
  })

  it('stops telling listeners when they unsubscribe', async () => {
    const piano = new FakePort('p')
    const { input } = await rig(piano)
    const seen: number[] = []
    const off = input.onUpdate((s) => seen.push(s.onsets.length))
    piano.noteOn(60, 1)
    off()
    piano.noteOn(62, 2)
    expect(seen).toEqual([1])
  })
})

describe('diagnostics', () => {
  it('describes raw messages in words', () => {
    expect(describeMidiMessage([0x90, 60, 100])).toBe('note on 60, velocity 100')
    expect(describeMidiMessage([0x80, 60, 0])).toBe('note off 60')
    expect(describeMidiMessage([0xb0, 64, 127])).toBe('sustain pedal (ignored)')
    expect(describeMidiMessage([0xb0, 7, 100])).toBe('controller 7 (ignored)')
    expect(describeMidiMessage([0xfe])).toBe('heartbeat (active sensing)')
    expect(describeMidiMessage([0xf8])).toBe('clock')
    expect(describeMidiMessage([0xe0, 0, 64])).toBe('pitch bend (ignored)')
    expect(describeMidiMessage([])).toBe('empty')
  })

  it('counts every message, separates background ones, and remembers the last, even ones that are ignored', async () => {
    const piano = new FakePort('p', 'MM8 Port 1')
    const { input } = await rig(piano)
    expect(input.diagnostics).toEqual({ messages: 0, background: 0, last: null })
    piano.send([0xfe], 1)
    piano.noteOn(60, 2, 100)
    piano.pedal(true, 3)
    expect(input.diagnostics).toEqual({
      messages: 3,
      background: 1,
      last: { port: 'MM8 Port 1', bytes: [0xb0, 64, 127], meaning: 'sustain pedal (ignored)' },
    })
  })

  it('starts counting again from nothing after stopping', async () => {
    const piano = new FakePort('p')
    const { input } = await rig(piano)
    piano.noteOn(60, 1)
    input.stop()
    expect(input.diagnostics.messages).toBe(0)
  })

  it('passes on whether the browser has each port open', async () => {
    const piano = new FakePort('p')
    piano.connection = 'closed'
    const { input } = await rig(piano)
    expect(input.devices[0].connection).toBe('closed')
  })
})

describe('devices', () => {
  it('lists the connected devices by name, with a fallback name', async () => {
    const { input } = await rig(new FakePort('a', 'Yamaha P-125'), new FakePort('b', null))
    expect(input.devices).toEqual([
      { id: 'a', name: 'Yamaha P-125', connected: true, connection: 'open' },
      { id: 'b', name: 'MIDI device', connected: true, connection: 'open' },
    ])
    expect(input.status).toBe('ready')
  })

  it('listens to every device by default, and the held notes of all of them add up', async () => {
    const a = new FakePort('a')
    const b = new FakePort('b')
    const { last } = await rig(a, b)
    a.noteOn(60, 1)
    b.noteOn(64, 2)
    expect(held(last())).toEqual([60, 64])
    a.noteOff(60, 3)
    expect(held(last())).toEqual([64])
  })

  it('can listen to just one device, and lets go of notes held on the others', async () => {
    const a = new FakePort('a')
    const b = new FakePort('b')
    const { input, last } = await rig(a, b)
    a.noteOn(60, 1)
    b.noteOn(64, 2)
    input.select('b')
    expect(input.selectedDeviceId).toBe('b')
    expect(held(last())).toEqual([64]) // a's key was let go of
    a.noteOn(62, 3) // no longer heard
    expect(held(last())).toEqual([64])
    b.noteOn(65, 4)
    expect(held(last())).toEqual([64, 65])
    input.select(null)
    a.noteOn(67, 5)
    expect(held(last())).toContain(67)
  })

  it('hot-plug: a piano plugged in while running is heard, and shows in the list', async () => {
    const { input, access, last } = await rig()
    expect(input.devices).toEqual([])
    const piano = new FakePort('new', 'Roland FP-30')
    access.plugIn(piano)
    expect(input.devices).toEqual([
      { id: 'new', name: 'Roland FP-30', connected: true, connection: 'open' },
    ])
    piano.noteOn(60, 1)
    expect(held(last())).toEqual([60])
  })

  it('a piano unplugged while keys are held releases them, is shown as not connected, and is heard again when it returns', async () => {
    const piano = new FakePort('p', 'Piano')
    const { input, access, last } = await rig(piano)
    piano.noteOn(60, 1)
    access.unplug(piano)
    expect(held(last())).toEqual([])
    expect(input.devices).toEqual([
      { id: 'p', name: 'Piano', connected: false, connection: 'open' },
    ])
    piano.noteOn(62, 2) // a disconnected port is not listened to
    expect(held(last())).toEqual([])
    access.plugIn(piano)
    expect(input.devices[0].connected).toBe(true)
    piano.noteOn(64, 3)
    expect(held(last())).toEqual([64])
  })

  it('tells screens when the status or the devices change', async () => {
    const access = new FakeMidiAccess()
    const input = new MidiInput({ requestAccess: async () => access })
    let changes = 0
    input.onChange(() => changes++)
    await input.start()
    const after = changes
    expect(after).toBeGreaterThan(0)
    access.plugIn(new FakePort('p'))
    expect(changes).toBeGreaterThan(after)
  })
})

describe('starting and stopping', () => {
  it('stop lets go of everything, stops listening, and can start again', async () => {
    const piano = new FakePort('p')
    const { input, states, last } = await rig(piano)
    piano.noteOn(60, 1)
    input.stop()
    expect(held(last())).toEqual([])
    expect(input.status).toBe('idle')
    expect(input.devices).toEqual([])
    const count = states.length
    piano.noteOn(62, 2)
    expect(states).toHaveLength(count)
    await input.start()
    piano.noteOn(64, 3)
    expect(held(last())).toEqual([64])
  })

  it('starting twice at once asks the browser once, and starting when ready does nothing', async () => {
    let asked = 0
    const access = new FakeMidiAccess()
    const input = new MidiInput({
      requestAccess: async () => {
        asked++
        return access
      },
    })
    await Promise.all([input.start(), input.start()])
    await input.start()
    expect(asked).toBe(1)
  })

  it('goes through "connecting" while the browser is asking', async () => {
    let allow: () => void = () => {}
    const access = new FakeMidiAccess()
    const input = new MidiInput({
      requestAccess: () => new Promise((r) => (allow = () => r(access))),
    })
    const started = input.start()
    expect(input.status).toBe('connecting')
    allow()
    await started
    expect(input.status).toBe('ready')
  })
})

describe('when MIDI is not available', () => {
  it('a browser with no Web MIDI says so, and names what to use instead', async () => {
    const input = new MidiInput({ requestAccess: null })
    await expect(input.start()).rejects.toBeInstanceOf(MidiUnavailableError)
    expect(input.status).toBe('unsupported')
    expect(input.error).toMatch(/Chrome, Edge or Opera/)
    expect(input.error).toMatch(/Safari/)
  })

  it('permission refused is "denied", for both ways a browser says no', async () => {
    for (const name of ['NotAllowedError', 'SecurityError']) {
      const input = new MidiInput({
        requestAccess: () => Promise.reject(Object.assign(new Error('no'), { name })),
      })
      await expect(input.start()).rejects.toMatchObject({ status: 'denied' })
      expect(input.status).toBe('denied')
      expect(input.error).toMatch(/blocked/)
    }
  })

  it('any other failure is an error that shows its reason, and a later attempt can still work', async () => {
    let fail = true
    const access = new FakeMidiAccess()
    const input = new MidiInput({
      requestAccess: () =>
        fail ? Promise.reject(new Error('driver crashed')) : Promise.resolve(access),
    })
    await expect(input.start()).rejects.toMatchObject({ status: 'error' })
    expect(input.status).toBe('error')
    expect(input.error).toMatch(/driver crashed/)
    fail = false
    await input.start()
    expect(input.status).toBe('ready')
  })

  it("with the browser's own API missing, the default is unsupported", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'requestMIDIAccess')
    // jsdom has no Web MIDI, so this is the real default.
    expect('requestMIDIAccess' in navigator).toBe(false)
    const input = new MidiInput()
    await expect(input.start()).rejects.toMatchObject({ status: 'unsupported' })
    expect(original).toBeUndefined()
  })
})
