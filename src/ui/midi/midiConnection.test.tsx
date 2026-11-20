import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { RequestMidiAccess } from '../../audio/inputs/MidiInput'
import { FakeMidiAccess, FakePort } from '../../test-utils/fakeMidi'
import { KeyIdScreen } from '../KeyIdScreen'
import { MidiTestScreen } from '../MidiTestScreen'
import { PlayScreen } from '../PlayScreen'
import { MidiProvider } from './MidiProvider'

const FAST = { getReadyMs: { first: 0, between: 0 }, feedbackMs: 30, revealMs: 30 }

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('piano-drill.input', 'midi')
})
afterEach(cleanup)

const button = (name: string | RegExp) => screen.getByRole('button', { name })
const strip = () => screen.getByLabelText('MIDI piano')
const stripText = () => strip().querySelector('.midi-strip-text')!.textContent
/** A MIDI request that counts how often it is asked. */
const counting = (access: FakeMidiAccess) => {
  const request = vi.fn(async () => access)
  return request as unknown as RequestMidiAccess & typeof request
}
const waitForTarget = () => waitFor(() => expect(screen.getByText('Play it!')).toBeTruthy())

describe('the connection strip on a drill screen', () => {
  it('connects a piano from the Sight-Read screen, without visiting Settings', async () => {
    render(
      <MemoryRouter>
        <PlayScreen
          timing={FAST}
          reps={1}
          midiAccess={async () => new FakeMidiAccess(new FakePort('p', 'MM8'))}
        />
      </MemoryRouter>,
    )
    expect(stripText()).toBe('Piano: not connected')
    await userEvent.click(within(strip()).getByRole('button', { name: 'Connect' }))
    expect(stripText()).toBe('Piano: MM8')
    expect(within(strip()).getByRole('button', { name: 'Reconnect' })).toBeTruthy()
  })

  it('connects a piano from the Key Signatures screen', async () => {
    render(
      <MemoryRouter>
        <KeyIdScreen
          timing={FAST}
          questions={2}
          midiAccess={async () => new FakeMidiAccess(new FakePort('p', 'MM8'))}
        />
      </MemoryRouter>,
    )
    await userEvent.click(within(strip()).getByRole('button', { name: 'Connect' }))
    expect(stripText()).toBe('Piano: MM8')
  })

  it('is not there when the on-screen piano is chosen', () => {
    localStorage.setItem('piano-drill.input', 'screen')
    render(
      <MemoryRouter>
        <PlayScreen timing={FAST} reps={1} midiAccess={async () => new FakeMidiAccess()} />
      </MemoryRouter>,
    )
    expect(screen.queryByLabelText('MIDI piano')).toBeNull()
  })

  it('says when no piano was found and Reconnect brings back a piano the browser did not announce', async () => {
    const piano = new FakePort('p', 'MM8')
    piano.state = 'disconnected'
    const access = new FakeMidiAccess(piano)
    render(
      <MemoryRouter>
        <PlayScreen timing={FAST} reps={1} midiAccess={async () => access} />
      </MemoryRouter>,
    )
    await userEvent.click(within(strip()).getByRole('button', { name: 'Connect' }))
    expect(stripText()).toBe('Piano: none found')
    piano.state = 'connected' // no event: the case where the browser never says the piano is back
    expect(stripText()).toBe('Piano: none found')
    await userEvent.click(within(strip()).getByRole('button', { name: 'Reconnect' }))
    expect(stripText()).toBe('Piano: MM8')
  })

  it('after an unplug, Reconnect on the strip works alongside the Resume flow', async () => {
    const piano = new FakePort('p', 'MM8')
    const access = new FakeMidiAccess(piano)
    render(
      <MemoryRouter>
        <PlayScreen timing={FAST} reps={3} midiAccess={async () => access} />
      </MemoryRouter>,
    )
    await userEvent.click(button('Start'))
    await waitForTarget()
    act(() => access.unplug(piano))
    await waitFor(() =>
      expect(document.querySelector('.keyid-status')!.textContent).toMatch(/Paused/),
    )
    expect(stripText()).toBe('Piano: none found')
    piano.state = 'connected' // back, but the browser has not said so
    await userEvent.click(within(strip()).getByRole('button', { name: 'Reconnect' }))
    await waitFor(() => expect((button('Resume') as HTMLButtonElement).disabled).toBe(false))
    await userEvent.click(button('Resume'))
    await waitForTarget()
  })

  it('lets you choose between pianos, only when there is more than one', async () => {
    const a = new FakePort('a', 'Piano A')
    const b = new FakePort('b', 'Piano B')
    render(
      <MemoryRouter>
        <PlayScreen timing={FAST} reps={1} midiAccess={async () => new FakeMidiAccess(a, b)} />
      </MemoryRouter>,
    )
    await userEvent.click(within(strip()).getByRole('button', { name: 'Connect' }))
    const choice = within(strip()).getByLabelText('Piano') as HTMLSelectElement
    expect(choice.value).toBe('')
    await userEvent.selectOptions(choice, 'b')
    expect(stripText()).toBe('Piano: Piano B')
    expect(localStorage.getItem('piano-drill.midi-device')).toBe('b')
    cleanup()
    render(
      <MemoryRouter>
        <PlayScreen
          timing={FAST}
          reps={1}
          midiAccess={async () => new FakeMidiAccess(new FakePort('a', 'Piano A'))}
        />
      </MemoryRouter>,
    )
    await userEvent.click(within(strip()).getByRole('button', { name: 'Connect' }))
    expect(within(strip()).queryByLabelText('Piano')).toBeNull() // one piano: nothing to choose
  })
})

describe('one connection for the whole app', () => {
  it('connecting on the MIDI Test page is connecting on the drill screens, with one request to the browser', async () => {
    const access = new FakeMidiAccess(new FakePort('p', 'MM8'))
    const request = counting(access)
    const at = (screenEl: React.ReactNode) => (
      <MidiProvider requestAccess={request}>
        <MemoryRouter>{screenEl}</MemoryRouter>
      </MidiProvider>
    )
    const { rerender } = render(at(<MidiTestScreen />))
    await userEvent.click(button('Connect'))
    expect(request).toHaveBeenCalledTimes(1)
    rerender(at(<PlayScreen timing={FAST} reps={1} />))
    expect(stripText()).toBe('Piano: MM8') // already connected: nothing to press
    rerender(at(<KeyIdScreen timing={FAST} questions={2} />))
    expect(stripText()).toBe('Piano: MM8')
    rerender(at(<MidiTestScreen />))
    expect(screen.getByRole('status').textContent).toMatch(/Listening/)
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('ending a session leaves the connection open for the next one', async () => {
    const piano = new FakePort('p', 'MM8')
    const request = counting(new FakeMidiAccess(piano))
    render(
      <MidiProvider requestAccess={request}>
        <MemoryRouter>
          <PlayScreen timing={FAST} reps={3} />
        </MemoryRouter>
      </MidiProvider>,
    )
    await userEvent.click(button('Start'))
    await waitForTarget()
    await userEvent.click(button('End'))
    expect(stripText()).toBe('Piano: MM8')
    await userEvent.click(button('Start'))
    await waitForTarget()
    await userEvent.click(button('End'))
    expect(request).toHaveBeenCalledTimes(1)
  })
})
