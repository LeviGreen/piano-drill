import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import {
  NO_PIANO_MESSAGE,
  PIANO_BACK_MESSAGE,
  PIANO_LOST_MESSAGE,
} from '../audio/inputs/drillInput'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import { KEY_ID_LEVELS } from '../keyid/presets'
import { KeyIdGenerator, tonicMatches, type KeyIdQuestion } from '../keyid/questions'
import { toQuestionConfig } from '../keyid/settings'
import { createLevelGenerator } from '../levels/levelGenerator'
import { PRESET_LEVELS } from '../levels/presets'
import { FakeMidiAccess, FakePort } from '../test-utils/fakeMidi'
import { pitch } from '../theory/pitch'
import type { Target } from '../theory/target'
import { KeyIdScreen } from './KeyIdScreen'
import { PlayScreen } from './PlayScreen'

const FAST = { getReadyMs: { first: 0, between: 0 }, feedbackMs: 30, revealMs: 30, silenceMs: 0 }
const SEED = Math.floor(0.123 * 1e6)

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('piano-drill.input', 'midi')
  vi.spyOn(Math, 'random').mockReturnValue(0.123)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const withAccess =
  (access: FakeMidiAccess): RequestMidiAccess =>
  async () =>
    access
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const notice = () => document.querySelector('.result-slot')!.textContent
const statusLine = () => document.querySelector('.keyid-status')!.textContent
const midisOf = (t: Target) => t.parts.flatMap((p) => p.pitches.map((x) => x.midi))
const firstTarget = () => createLevelGenerator(PRESET_LEVELS[0].settings, SEED).next()

const showPlay = (props: Parameters<typeof PlayScreen>[0] = {}) =>
  render(
    <MemoryRouter>
      <PlayScreen timing={FAST} reps={1} {...props} />
    </MemoryRouter>,
  )
const showKeyId = (props: Parameters<typeof KeyIdScreen>[0] = {}) =>
  render(
    <MemoryRouter>
      <KeyIdScreen timing={FAST} questions={3} {...props} />
    </MemoryRouter>,
  )
const waitForTarget = () => waitFor(() => expect(screen.getByText('Play it!')).toBeTruthy())

describe('Play with a MIDI piano', () => {
  it('a drill is played on the real piano: the notes it sends are the answer', async () => {
    const piano = new FakePort('p', 'MM8')
    showPlay({ midiAccess: withAccess(new FakeMidiAccess(piano)) })
    await userEvent.click(button('Start'))
    await waitForTarget()
    for (const m of midisOf(firstTarget())) act(() => piano.noteOn(m, performance.now()))
    const summary = await screen.findByRole('dialog', { name: 'Session summary' })
    expect(within(summary).getByLabelText('Score').textContent).toMatch(/^[\d,]+ \/ 200/)
  })

  it('a wrong note on the real piano is marked on the on-screen keyboard, and does not end the target', async () => {
    const piano = new FakePort('p', 'MM8')
    showPlay({ midiAccess: withAccess(new FakeMidiAccess(piano)) })
    await userEvent.click(button('Start'))
    await waitForTarget()
    const [right] = midisOf(firstTarget())
    const wrong = right === 60 ? 62 : 60
    act(() => piano.noteOn(wrong, performance.now()))
    await waitFor(() =>
      expect(
        document.querySelector(`svg.keyboard [data-midi="${wrong}"]`)!.classList.contains('wrong'),
      ).toBe(true),
    )
    expect(screen.getByText('Play it!')).toBeTruthy()
  })

  it('the on-screen piano still works while MIDI is chosen', async () => {
    showPlay({ midiAccess: withAccess(new FakeMidiAccess(new FakePort('p'))) })
    await userEvent.click(button('Start'))
    await waitForTarget()
    for (const m of midisOf(firstTarget())) {
      fireEvent.pointerDown(document.querySelector(`svg.keyboard [data-midi="${m}"]`)!, {
        pointerId: 1,
      })
      fireEvent.pointerUp(window, { pointerId: 1 })
    }
    await screen.findByRole('dialog', { name: 'Session summary' })
  })

  it('the input choice is in the settings, remembered, and shared with Key ID', async () => {
    localStorage.clear()
    showPlay({ midiAccess: withAccess(new FakeMidiAccess()) })
    await userEvent.click(button('Settings'))
    const choice = within(screen.getByRole('dialog')).getByLabelText('Input') as HTMLSelectElement
    expect(choice.value).toBe('screen') // the on-screen piano until you choose
    await userEvent.selectOptions(choice, 'midi')
    expect(localStorage.getItem('piano-drill.input')).toBe('midi')
    cleanup()
    showKeyId({ midiAccess: withAccess(new FakeMidiAccess()) })
    await userEvent.click(button('Settings'))
    expect(
      (within(screen.getByRole('dialog')).getByLabelText('Input') as HTMLSelectElement).value,
    ).toBe('midi')
  })

  it('the input choice locks during a session', async () => {
    showPlay({ midiAccess: withAccess(new FakeMidiAccess(new FakePort('p'))) })
    await userEvent.click(button('Start'))
    await userEvent.click(button('Settings'))
    expect(
      (within(screen.getByRole('dialog')).getByLabelText('Input') as HTMLSelectElement).disabled,
    ).toBe(true)
    await userEvent.keyboard('{Escape}')
    await userEvent.click(button('End'))
  })
})

describe('Play when MIDI cannot be used', () => {
  it('no piano plugged in: says so, and does not start', async () => {
    showPlay({ midiAccess: withAccess(new FakeMidiAccess()) })
    await userEvent.click(button('Start'))
    await waitFor(() => expect(notice()).toBe(NO_PIANO_MESSAGE))
    expect(screen.getByText('Press Start.')).toBeTruthy()
    expect((button('Start') as HTMLButtonElement).disabled).toBe(false) // can try again
    expect(document.querySelector('.midi-problem')).toBeTruthy()
  })

  it('a browser without MIDI says which browsers to use', async () => {
    showPlay({ midiAccess: null })
    await userEvent.click(button('Start'))
    await waitFor(() => expect(notice()).toMatch(/Chrome, Edge or Opera/))
    expect(screen.getByText('Press Start.')).toBeTruthy()
  })

  it('a blocked permission says how to allow it', async () => {
    showPlay({
      midiAccess: () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })),
    })
    await userEvent.click(button('Start'))
    await waitFor(() => expect(notice()).toMatch(/blocked/))
  })

  it('plugging a piano in and trying again works, and the message goes away', async () => {
    const access = new FakeMidiAccess()
    showPlay({ midiAccess: withAccess(access) })
    await userEvent.click(button('Start'))
    await waitFor(() => expect(notice()).toBe(NO_PIANO_MESSAGE))
    access.plugIn(new FakePort('p', 'MM8'))
    await userEvent.click(button('Start'))
    await waitForTarget()
    expect(notice()).not.toBe(NO_PIANO_MESSAGE)
  })

  it('switching to the on-screen piano then lets you play with no MIDI at all', async () => {
    showPlay({ midiAccess: null })
    await userEvent.click(button('Start'))
    await waitFor(() => expect(notice()).toMatch(/Chrome/))
    await userEvent.click(button('Settings'))
    await userEvent.selectOptions(
      within(screen.getByRole('dialog')).getByLabelText('Input'),
      'screen',
    )
    expect(notice()).toBe('') // the old message is gone
    await userEvent.keyboard('{Escape}')
    await userEvent.click(button('Start'))
    await waitForTarget()
  })
})

describe('unplugging the piano during a session', () => {
  it('pauses with a clear message, keeps Resume off until it is back, and carries on after Resume', async () => {
    const piano = new FakePort('p', 'MM8')
    const access = new FakeMidiAccess(piano)
    showPlay({ midiAccess: withAccess(access), reps: 3 })
    await userEvent.click(button('Start'))
    await waitForTarget()
    act(() => access.unplug(piano))
    await waitFor(() => expect(statusLine()).toMatch(/Paused/))
    expect(notice()).toBe(PIANO_LOST_MESSAGE)
    expect((button('Resume') as HTMLButtonElement).disabled).toBe(true)
    act(() => access.plugIn(piano))
    await waitFor(() => expect(notice()).toBe(PIANO_BACK_MESSAGE))
    expect((button('Resume') as HTMLButtonElement).disabled).toBe(false)
    await userEvent.click(button('Resume'))
    expect(notice()).toBe('')
    await waitForTarget() // the drill carries on
  })

  it('unplugging a piano that is not the chosen one changes nothing', async () => {
    localStorage.setItem('piano-drill.midi-device', 'mine')
    const mine = new FakePort('mine')
    const other = new FakePort('other')
    const access = new FakeMidiAccess(mine, other)
    showPlay({ midiAccess: withAccess(access) })
    await userEvent.click(button('Start'))
    await waitForTarget()
    act(() => access.unplug(other))
    expect(notice()).toBe('')
    expect(screen.getByText('Play it!')).toBeTruthy()
    await userEvent.click(button('End'))
  })
})

describe('Key ID with a MIDI piano', () => {
  const upcoming = (): KeyIdQuestion => {
    const g = new KeyIdGenerator(toQuestionConfig(KEY_ID_LEVELS[0].settings), SEED)
    return g.next()
  }

  it('in the Play view, the tonic played on the real piano answers the question', async () => {
    const piano = new FakePort('p', 'MM8')
    showKeyId({ midiAccess: withAccess(new FakeMidiAccess(piano)) })
    await userEvent.click(button('Play'))
    await userEvent.click(button('Start'))
    const q = upcoming()
    await screen.findByText(q.prompt)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    const tonic = pitch(q.key.tonic.letter, q.key.tonic.accidental, 3).midi
    // A wrong note first, somewhere on the one octave the screen piano shows (C4 to C5).
    const wrong = Array.from({ length: 13 }, (_, i) => 60 + i).find((m) => !tonicMatches(q, m))!
    act(() => piano.noteOn(wrong, performance.now()))
    await waitFor(() =>
      expect(document.querySelectorAll('svg.keyboard .kb-key.wrong').length).toBeGreaterThan(0),
    )
    expect(statusLine()).toMatch(/Question 1 of/)
    act(() => piano.noteOn(tonic, performance.now()))
    await screen.findByText(/Question 2 of 3/)
  })

  it('says when there is no piano, and does not start', async () => {
    showKeyId({ midiAccess: withAccess(new FakeMidiAccess()) })
    await userEvent.click(button('Start'))
    await waitFor(() => expect(notice()).toBe(NO_PIANO_MESSAGE))
    expect(screen.getByText('Press Start.')).toBeTruthy()
  })

  it('unplugging mid-question pauses, with the same message', async () => {
    const piano = new FakePort('p')
    const access = new FakeMidiAccess(piano)
    showKeyId({ midiAccess: withAccess(access) })
    await userEvent.click(button('Start'))
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    act(() => access.unplug(piano))
    await waitFor(() => expect(statusLine()).toMatch(/Paused/))
    expect(notice()).toBe(PIANO_LOST_MESSAGE)
    expect((button('Resume') as HTMLButtonElement).disabled).toBe(true)
  })

  it('tapping the wheel still works with MIDI chosen', async () => {
    showKeyId({ midiAccess: withAccess(new FakeMidiAccess(new FakePort('p'))) })
    await userEvent.click(button('Start'))
    const q = upcoming()
    await screen.findByText(q.prompt)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    const name = `${q.key.tonic.letter}${['𝄫', '♭', '', '♯', '𝄪'][q.key.tonic.accidental + 2]} major`
    await userEvent.click(button(name))
    await screen.findByText(/Question 2 of 3/)
  })
})
