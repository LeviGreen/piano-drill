import { beforeEach, describe, expect, it } from 'vitest'
import { FakeMidiAccess, FakePort } from '../../test-utils/fakeMidi'
import {
  connectMidi,
  createDrillInput,
  loadInputChoice,
  loadMidiDevice,
  NO_PIANO_MESSAGE,
  pianoConnected,
  saveInputChoice,
} from './drillInput'
import { MidiInput, MidiUnavailableError } from './MidiInput'

beforeEach(() => localStorage.clear())

describe('the remembered input choice', () => {
  it('is the on-screen piano until you choose otherwise, and remembers a choice', () => {
    expect(loadInputChoice()).toBe('screen')
    saveInputChoice('midi')
    expect(loadInputChoice()).toBe('midi')
    saveInputChoice('screen')
    expect(loadInputChoice()).toBe('screen')
  })

  it('ignores a stored value it does not know', () => {
    localStorage.setItem('piano-drill.input', 'banana')
    expect(loadInputChoice()).toBe('screen')
  })

  it('reads the piano chosen on the MIDI test screen', () => {
    expect(loadMidiDevice()).toBeNull()
    localStorage.setItem('piano-drill.midi-device', 'abc')
    expect(loadMidiDevice()).toBe('abc')
  })
})

describe('building the input for a drill', () => {
  it('the on-screen piano alone has no MIDI', () => {
    const d = createDrillInput('screen')
    expect(d.midi).toBeNull()
    expect(d.input).toBe(d.screen)
  })

  it('MIDI is heard together with the on-screen piano, and uses the piano chosen before', async () => {
    localStorage.setItem('piano-drill.midi-device', 'b')
    const a = new FakePort('a')
    const b = new FakePort('b')
    const d = createDrillInput('midi', { requestAccess: async () => new FakeMidiAccess(a, b) })
    expect(d.midi).toBeInstanceOf(MidiInput)
    await d.input.start()
    expect(d.midi!.selectedDeviceId).toBe('b')
    const seen: number[] = []
    d.input.onUpdate((s) => seen.push(...s.onsets.map((o) => o.midi)))
    a.noteOn(60, 1) // not the chosen piano
    b.noteOn(62, 2)
    d.screen.press(64) // the on-screen piano still works
    expect(seen).toEqual([62, 64])
  })
})

describe('connecting MIDI before a session', () => {
  it('works when a piano is plugged in', async () => {
    const midi = new MidiInput({ requestAccess: async () => new FakeMidiAccess(new FakePort('p')) })
    await connectMidi(midi)
    expect(midi.status).toBe('ready')
    expect(pianoConnected(midi)).toBe(true)
  })

  it('says so when there is no piano, and does not stay connected', async () => {
    const midi = new MidiInput({ requestAccess: async () => new FakeMidiAccess() })
    await expect(connectMidi(midi)).rejects.toThrow(NO_PIANO_MESSAGE)
    expect(midi.status).toBe('idle')
  })

  it('passes on a blocked permission or a browser without MIDI', async () => {
    await expect(connectMidi(new MidiInput({ requestAccess: null }))).rejects.toBeInstanceOf(
      MidiUnavailableError,
    )
    const denied = new MidiInput({
      requestAccess: () =>
        Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })),
    })
    await expect(connectMidi(denied)).rejects.toMatchObject({ status: 'denied' })
  })

  it('a chosen piano that is unplugged does not count, even if another is connected', async () => {
    const other = new FakePort('other')
    const midi = new MidiInput({
      requestAccess: async () => new FakeMidiAccess(other),
      deviceId: 'mine',
    })
    await midi.start()
    expect(pianoConnected(midi)).toBe(false)
    midi.select(null)
    expect(pianoConnected(midi)).toBe(true)
  })
})
