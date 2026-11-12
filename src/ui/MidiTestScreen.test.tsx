import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import { FakeMidiAccess, FakePort } from '../test-utils/fakeMidi'
import { MidiTestScreen } from './MidiTestScreen'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const show = (requestAccess?: RequestMidiAccess | null) =>
  render(
    <MemoryRouter>
      <MidiTestScreen requestAccess={requestAccess} />
    </MemoryRouter>,
  )
const withAccess =
  (access: FakeMidiAccess): RequestMidiAccess =>
  async () =>
    access
const status = () => screen.getByRole('status').textContent
const key = (midi: number) => document.querySelector(`svg.keyboard [data-midi="${midi}"]`)!

describe('before connecting', () => {
  it('asks you to connect, with nothing else to do yet', () => {
    show(withAccess(new FakeMidiAccess()))
    expect(status()).toMatch(/Press Connect/)
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
    expect(screen.queryByLabelText('Piano')).toBeNull()
    expect(screen.getByText('None yet.')).toBeTruthy()
  })
})

describe('connecting', () => {
  it('a browser without MIDI says which browsers to use instead', async () => {
    show(null)
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(status()).toMatch(/Chrome, Edge or Opera/)
    expect(status()).toMatch(/Safari/)
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy() // can try again
  })

  it('the real default is "unsupported" where the browser has no Web MIDI', async () => {
    show() // no injected access: uses the browser's own, which jsdom does not have
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(status()).toMatch(/can't read MIDI/)
  })

  it('refused permission says how to allow it', async () => {
    show(() => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(status()).toMatch(/blocked.*site settings/)
  })

  it('with no piano plugged in it says so', async () => {
    show(withAccess(new FakeMidiAccess()))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(status()).toMatch(/no MIDI device was found/)
  })

  it('with a piano it lists it and listens', async () => {
    show(withAccess(new FakeMidiAccess(new FakePort('p', 'Yamaha P-125'))))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(status()).toMatch(/Listening/)
    const select = screen.getByLabelText('Piano')
    expect(within(select).getByRole('option', { name: 'All devices' })).toBeTruthy()
    expect(within(select).getByRole('option', { name: 'Yamaha P-125' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy()
  })
})

describe('playing', () => {
  it('shows the notes you hold on the keyboard, and each note played in a table', async () => {
    const piano = new FakePort('p', 'Piano')
    show(withAccess(new FakeMidiAccess(piano)))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    act(() => piano.noteOn(60, performance.now(), 100))
    act(() => piano.noteOn(64, performance.now() + 250, 64))
    expect(key(60).classList.contains('heard')).toBe(true)
    expect(key(64).classList.contains('heard')).toBe(true)
    act(() => piano.noteOff(60, performance.now()))
    expect(key(60).classList.contains('heard')).toBe(false)
    expect(key(64).classList.contains('heard')).toBe(true)
    const rows = within(screen.getByRole('table', { name: 'Notes played' }))
      .getAllByRole('row')
      .slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('E4')).toBeTruthy() // newest first
    expect(within(rows[0]).getByText('64')).toBeTruthy() // velocity
    expect(within(rows[0]).getByText(/^2[45]\d ms$|^\d{3} ms$/)).toBeTruthy() // after the previous note
    expect(within(rows[1]).getByText('C4')).toBeTruthy()
    expect(within(rows[1]).getByText('100')).toBeTruthy()
    expect(within(rows[1]).getByText('–')).toBeTruthy() // the first note has no previous
  })

  it('shows only the last few notes', async () => {
    const piano = new FakePort('p')
    show(withAccess(new FakeMidiAccess(piano)))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    for (let i = 0; i < 12; i++) act(() => piano.noteOn(48 + i, performance.now()))
    expect(
      within(screen.getByRole('table', { name: 'Notes played' }))
        .getAllByRole('row')
        .slice(1),
    ).toHaveLength(8)
  })

  it('a piano plugged in later appears in the list and is heard', async () => {
    const access = new FakeMidiAccess()
    show(withAccess(access))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    const piano = new FakePort('late', 'Casio CT-S1')
    act(() => access.plugIn(piano))
    expect(status()).toMatch(/Listening/)
    expect(
      within(screen.getByLabelText('Piano')).getByRole('option', { name: 'Casio CT-S1' }),
    ).toBeTruthy()
    act(() => piano.noteOn(67, performance.now()))
    expect(key(67).classList.contains('heard')).toBe(true)
  })

  it('a piano unplugged while a key is held lets go of the key and says it is not connected', async () => {
    const piano = new FakePort('p', 'Piano')
    const access = new FakeMidiAccess(piano)
    show(withAccess(access))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await userEvent.selectOptions(screen.getByLabelText('Piano'), 'p')
    act(() => piano.noteOn(60, performance.now()))
    act(() => access.unplug(piano))
    expect(key(60).classList.contains('heard')).toBe(false)
    expect(status()).toMatch(/chosen piano is not connected/)
    expect(
      within(screen.getByLabelText('Piano')).getByRole('option', { name: 'Piano (not connected)' }),
    ).toBeTruthy()
  })
})

describe('choosing a piano', () => {
  it('listens only to the chosen piano, and remembers the choice for next time', async () => {
    const a = new FakePort('a', 'Piano A')
    const b = new FakePort('b', 'Piano B')
    show(withAccess(new FakeMidiAccess(a, b)))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await userEvent.selectOptions(screen.getByLabelText('Piano'), 'b')
    act(() => a.noteOn(60, performance.now()))
    expect(key(60).classList.contains('heard')).toBe(false)
    act(() => b.noteOn(62, performance.now()))
    expect(key(62).classList.contains('heard')).toBe(true)
    expect(localStorage.getItem('piano-drill.midi-device')).toBe('b')

    cleanup()
    const a2 = new FakePort('a', 'Piano A')
    const b2 = new FakePort('b', 'Piano B')
    show(withAccess(new FakeMidiAccess(a2, b2)))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect((screen.getByLabelText('Piano') as HTMLSelectElement).value).toBe('b')
    act(() => a2.noteOn(64, performance.now()))
    expect(key(64).classList.contains('heard')).toBe(false)
  })

  it('"All devices" clears the choice', async () => {
    localStorage.setItem('piano-drill.midi-device', 'a')
    show(withAccess(new FakeMidiAccess(new FakePort('a', 'Piano A'))))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    await userEvent.selectOptions(screen.getByLabelText('Piano'), '')
    expect(localStorage.getItem('piano-drill.midi-device')).toBeNull()
  })

  it('a remembered piano that is not plugged in is explained, not silently ignored', async () => {
    localStorage.setItem('piano-drill.midi-device', 'gone')
    show(withAccess(new FakeMidiAccess(new FakePort('other', 'Other piano'))))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(status()).toMatch(/chosen piano is not connected/)
    expect(
      within(screen.getByLabelText('Piano')).getByRole('option', {
        name: 'Saved piano (not connected)',
      }),
    ).toBeTruthy()
  })
})

describe('disconnecting', () => {
  it('goes back to not connected and clears the keys', async () => {
    const piano = new FakePort('p')
    show(withAccess(new FakeMidiAccess(piano)))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    act(() => piano.noteOn(60, performance.now()))
    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
    expect(status()).toMatch(/Not connected/)
    expect(key(60).classList.contains('heard')).toBe(false)
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy()
  })
})

describe('diagnostics: is the piano really sending?', () => {
  const diag = () => screen.getByText('Diagnostics').closest('details')!
  const connect = async (...ports: FakePort[]) => {
    show(withAccess(new FakeMidiAccess(...ports)))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  }

  it('says none yet before anything arrives, and lists each piano with its state and port', async () => {
    const piano = new FakePort('p', 'MM8 Port 1')
    await connect(piano)
    expect(within(diag()).getByText(/Messages received:/).textContent).toMatch(
      /0.*0 real, 0 background/,
    )
    expect(within(diag()).getByText(/none yet/)).toBeTruthy()
    const cells = within(diag()).getAllByRole('row')[1].querySelectorAll('td')
    expect([...cells].map((c) => c.textContent)).toEqual(['MM8 Port 1', 'connected', 'open'])
  })

  it('shows a port the browser could not open, which is how a piano another program is holding looks', async () => {
    const piano = new FakePort('p', 'MM8 Port 1')
    piano.connection = 'closed'
    await connect(piano)
    expect(within(diag()).getByText('closed')).toBeTruthy()
  })

  it('counts every message and shows the last one in hex with what it means and where it came from', async () => {
    const piano = new FakePort('p', 'MM8 Port 1')
    await connect(piano)
    act(() => piano.noteOn(60, performance.now(), 100))
    expect(within(diag()).getByText('90 3C 64')).toBeTruthy()
    expect(within(diag()).getByText(/from MM8 Port 1: note on 60, velocity 100/)).toBeTruthy()
    expect(within(diag()).getByText(/Messages received:/).textContent).toMatch(
      /1.*1 real, 0 background/,
    )
  })

  it('tells background heartbeat and clock apart from real messages, and notes the pedal is ignored', async () => {
    const piano = new FakePort('p', 'MM8 Port 1')
    await connect(piano)
    act(() => piano.send([0xfe], performance.now()))
    act(() => piano.send([0xf8], performance.now()))
    act(() => piano.pedal(true, performance.now()))
    expect(within(diag()).getByText(/Messages received:/).textContent).toMatch(
      /3.*1 real, 2 background/,
    )
    expect(within(diag()).getByText(/sustain pedal \(ignored\)/)).toBeTruthy()
  })

  it('is not shown until connected', () => {
    show(withAccess(new FakeMidiAccess(new FakePort('p'))))
    expect(screen.queryByText('Diagnostics')).toBeNull()
  })
})
