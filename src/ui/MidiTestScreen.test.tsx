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
    expect(screen.getByRole('heading', { level: 1, name: 'MIDI Test' })).toBeTruthy()
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
  it('shows the notes you hold on the keyboard', async () => {
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

describe('devices: does the browser see the piano?', () => {
  const devices = () => screen.getByRole('table', { name: 'Devices' })
  const connect = async (...ports: FakePort[]) => {
    show(withAccess(new FakeMidiAccess(...ports)))
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  }

  it('lists each piano with its state and port', async () => {
    await connect(new FakePort('p', 'MM8 Port 1'))
    const cells = within(devices()).getAllByRole('row')[1].querySelectorAll('td')
    expect([...cells].map((c) => c.textContent)).toEqual(['MM8 Port 1', 'connected', 'open'])
  })

  it('shows a port the browser could not open, which is how a piano another program is holding looks', async () => {
    const piano = new FakePort('p', 'MM8 Port 1')
    piano.connection = 'closed'
    await connect(piano)
    expect(within(devices()).getByText('closed')).toBeTruthy()
  })

  it('has no message counters or note log', async () => {
    await connect(new FakePort('p'))
    expect(screen.queryByText(/Messages received/)).toBeNull()
    expect(screen.queryByText(/Last message/)).toBeNull()
    expect(screen.queryByText('Notes played')).toBeNull()
  })

  it('shows no list until connected, or when there is no piano', async () => {
    show(withAccess(new FakeMidiAccess(new FakePort('p'))))
    expect(screen.queryByRole('table', { name: 'Devices' })).toBeNull()
  })
})
