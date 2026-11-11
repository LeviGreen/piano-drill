import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { KeyIdGenerator, type KeyIdQuestion } from '../keyid/questions'
import { parseKeyIdSettings, toQuestionConfig, type KeyIdSettings } from '../keyid/settings'
import { answerLabel } from '../keyid/labels'
import { pitch } from '../theory/pitch'
import { KeyIdScreen } from './KeyIdScreen'

const STORAGE_KEY = 'piano-drill.keyid-settings'
const FAST = { getReadyMs: { first: 0, between: 0 }, feedbackMs: 30, revealMs: 30 }

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
beforeEach(() => {
  localStorage.clear()
  vi.spyOn(Math, 'random').mockReturnValue(0.123) // the screen seeds its question generator with Math.random
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const store = (over: Record<string, unknown>): KeyIdSettings => {
  const r = parseKeyIdSettings({ ...over })
  if (!r.ok) throw new Error(r.errors.join(', '))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r.settings))
  return r.settings
}
const show = (props: Parameters<typeof KeyIdScreen>[0] = {}) =>
  render(
    <MemoryRouter>
      <KeyIdScreen {...props} />
    </MemoryRouter>,
  )
/** The questions the screen will ask, since its generator is seeded from the mocked Math.random. */
const upcoming = (s: KeyIdSettings, n: number): KeyIdQuestion[] => {
  const g = new KeyIdGenerator(toQuestionConfig(s), Math.floor(0.123 * 1e6))
  return Array.from({ length: n }, () => g.next())
}
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const message = () => document.querySelector('.result-slot')!.textContent!
const answerButton = (q: KeyIdQuestion) => button(answerLabel(q.answer))

describe('before starting', () => {
  it('shows an empty staff and a disabled answer area, with the controls ready', () => {
    store({})
    show()
    expect(screen.getByRole('heading', { name: 'Key ID' })).toBeTruthy()
    expect(screen.getByText('Press Start.')).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(1)
    expect(document.querySelectorAll('.staff .vf-clef')).toHaveLength(1)
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(0)
    expect(document.querySelectorAll('.staff .vf-keysignature')).toHaveLength(1) // an empty one: the staff is there before the game
    expect(button('C major').getAttribute('aria-disabled')).toBe('true')
    expect((button('Start') as HTMLButtonElement).disabled).toBe(false)
    expect((button('Pause') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Skip') as HTMLButtonElement).disabled).toBe(true)
  })

  it('starts on level 1 the first time, and remembers custom settings afterwards', () => {
    show()
    expect(screen.getByText('Press Start.')).toBeTruthy()
    cleanup()
    store({ maxAccidentals: 5, modes: 'both' })
    show()
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      maxAccidentals: 5,
      modes: 'both',
    })
  })
})

describe('playing a session (tap answers)', () => {
  it('shows the question and the staff when it flashes, and a right answer says nothing (the green mark shows it)', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt) // flashed
    expect(document.querySelectorAll('.staff .vf-keysignature').length).toBe(1)
    await userEvent.click(answerButton(q))
    await screen.findByText(/Question 2 of 20/)
    expect(message()).toBe('')
  })

  it('says Not quite and what the answer was for a wrong answer, then moves on to the next question', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q1, q2] = upcoming(s, 2)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q1.prompt)
    const wrong = button(q1.answer.accidentals === 0 ? 'G major' : 'C major')
    await userEvent.click(wrong)
    await waitFor(() =>
      expect(message()).toBe(`Not quite. The answer is ${answerLabel(q1.answer)}.`),
    )
    await waitFor(() => expect(screen.getByText(/Question 2 of 20/)).toBeTruthy())
    expect(q2).toBeDefined()
  })

  it('skip reveals the answer', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await userEvent.click(button('Skip'))
    await waitFor(() => expect(message()).toBe(`Skipped. The answer is ${answerLabel(q.answer)}.`))
  })

  it('runs a full session, then shows a modal with the score and total time, only at the end', async () => {
    const s = store({ maxAccidentals: 3 })
    const qs = upcoming(s, 3)
    show({ timing: FAST, questions: 3 })
    await userEvent.click(button('Start'))
    for (const q of qs) {
      await screen.findByText(q.prompt)
      await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
      await userEvent.click(answerButton(q))
    }
    const summary = await screen.findByRole(
      'dialog',
      { name: 'Session summary' },
      { timeout: 3000 },
    )
    expect(within(summary).getByText(/3 of 3 correct \(100%\)/)).toBeTruthy()
    expect(within(summary).getByText(/Total time: \d+:\d\d/)).toBeTruthy()
    expect(within(summary).queryByRole('table')).toBeNull() // no per-question times
    expect(screen.getByText('Session complete.')).toBeTruthy()
    expect((button('Start') as HTMLButtonElement).disabled).toBe(false) // can go again
  })

  it('lists the mix-ups after wrong answers: which key you said for which', async () => {
    const s = store({ maxAccidentals: 3 })
    const qs = upcoming(s, 2)
    show({ timing: FAST, questions: 2 })
    await userEvent.click(button('Start'))
    for (const q of qs) {
      await screen.findByText(q.prompt)
      await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
      // Always answer "C major" (wrong unless the question is C major).
      await userEvent.click(button('C major'))
      await waitFor(() => expect(message()).not.toBe('')).catch(() => {}) // the last one clears fast
      await waitFor(() => expect(message()).toBe(''), { timeout: 2000 }).catch(() => {})
    }
    const summary = await screen.findByRole(
      'dialog',
      { name: 'Session summary' },
      { timeout: 3000 },
    )
    const wrongOnes = qs.filter((q) => q.answer.accidentals !== 0)
    if (wrongOnes.length > 0) {
      expect(within(summary).getByText('Mix-ups')).toBeTruthy()
      expect(within(summary).getAllByText(/you said C major/).length).toBeGreaterThan(0)
    }
  })

  it('does not rearrange the page when an answer arrives: the staff, answer area and result area are the same elements', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    const staff = document.querySelector('.staff')
    const slot = document.querySelector('.result-slot')
    const hint = document.querySelector('.answer-pending')
    await userEvent.click(answerButton(q))
    await screen.findByText(/Question 2 of 20/)
    expect(document.querySelector('.staff')).toBe(staff)
    expect(document.querySelector('.result-slot')).toBe(slot)
    expect(document.querySelector('.answer-pending')).toBe(hint)
  })

  it('counts down 4, 3, 2, 1 over the empty staff before the first question, and is gone after End', async () => {
    store({})
    show() // the product timing: 4 seconds
    expect(screen.queryByRole('timer')).toBeNull()
    await userEvent.click(button('Start'))
    expect(screen.getByRole('timer').textContent).toBe('4')
    expect(screen.getByText('Get ready…')).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-keysignature')).toHaveLength(1)
    await userEvent.click(button('End'))
    expect(screen.queryByRole('timer')).toBeNull()
    expect(screen.getByText('Session ended.')).toBeTruthy()
  })

  it('pauses and resumes', async () => {
    store({})
    show()
    await userEvent.click(button('Start'))
    await userEvent.click(button('Pause'))
    expect(screen.getByText(/Paused/)).toBeTruthy()
    await userEvent.click(button('Resume'))
    expect(screen.getByRole('timer')).toBeTruthy() // the 4-second countdown comes back
    await userEvent.click(button('End'))
  })
})

describe('the settings drawer', () => {
  it('opens over the page as a dialog, closes with Escape or Close, and does not sit above the game', async () => {
    store({})
    show()
    expect(screen.queryByRole('dialog')).toBeNull() // settings are not on the page itself
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog', { name: 'Key ID settings' })
    expect(within(dialog).getByLabelText('Level')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    await userEvent.click(button('Settings'))
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('picking a level loads its settings; changing an option makes it Custom and saves it', async () => {
    show()
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), '5')
    expect((within(dialog).getByLabelText('Keys') as HTMLSelectElement).value).toBe('both')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Up to this many/), '6')
    expect((within(dialog).getByLabelText('Level') as HTMLSelectElement).value).toBe('custom')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      modes: 'both',
      maxAccidentals: 6,
      name: 'Custom',
    })
  })

  it('has only the simple options: level, sharps and flats, keys, time limit', async () => {
    show()
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog')
    const labels = [...dialog.querySelectorAll('label')].map((l) => l.textContent!.split('\n')[0])
    expect(
      labels.map((l) =>
        l.replace(/(Level|Keys|Time limit per question|Up to this many sharps or flats).*/, '$1'),
      ),
    ).toEqual(['Level', 'Up to this many sharps or flats', 'Keys', 'Time limit per question'])
    for (const gone of ['Question type', 'Answer by', 'Clef', /F♯/]) {
      expect(within(dialog).queryByLabelText(gone)).toBeNull()
    }
  })

  it('locks the options during a session', async () => {
    store({})
    show()
    await userEvent.click(button('Start'))
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('Keys') as HTMLSelectElement).disabled).toBe(true)
    expect(within(dialog).getByText(/locked during a session/i)).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(button('End'))
  })
})

describe('the screen shows one treble staff, centred, with the answer input under it', () => {
  it('has a treble clef only and a minor-key question shows the tonic note', async () => {
    const s = store({ modes: 'both', maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    expect(document.querySelectorAll('.staff .vf-clef')).toHaveLength(1)
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(1) // the tonic
    expect(document.querySelector('.keyid-screen .answer-input')).toBeTruthy()
  })
})

describe('the question clock', () => {
  const clock = () => document.querySelector('.keyid-clock')!.textContent
  it('counts down in whole seconds from the time allowed, on its own line apart from the status', async () => {
    store({ timeoutSeconds: 10 })
    show({ timing: FAST })
    expect(clock()).toBe('')
    await userEvent.click(button('Start'))
    await waitFor(() => expect(Number(clock())).toBeGreaterThan(0))
    expect(Number(clock())).toBeLessThanOrEqual(10)
    expect(document.querySelector('.keyid-status')!.textContent).not.toMatch(/\d+ s|·/)
    await userEvent.click(button('End'))
    expect(clock()).toBe('')
  })

  it('shows no clock when there is no time limit', async () => {
    store({ timeoutSeconds: null })
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(/Which major key/)
    expect(clock()).toBe('')
    await userEvent.click(button('End'))
  })
})

describe('the tonic note is a clue, so it only shows when major and minor are mixed', () => {
  it.each([
    ['major', 0],
    ['minor', 0],
    ['both', 1],
  ])('keys: %s shows %i note(s)', async (modes, notes) => {
    const s = store({ modes, maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(notes)
  })
})

describe('answering by playing the tonic (on-screen keys stand in for the piano)', () => {
  const play = async (q: KeyIdQuestion, semitonesAboveTonic: number) => {
    const tonic = pitch(q.key.tonic.letter, q.key.tonic.accidental, 4).midi % 12
    const keys = [...document.querySelectorAll<SVGElement>('svg.keyboard [data-midi]')]
    const target = keys.find(
      (k) => Number(k.dataset.midi) % 12 === (tonic + semitonesAboveTonic) % 12,
    )!
    await userEvent.click(target)
  }

  it('the Play view shows a piano instead of the wheel, and the tonic in any octave is correct', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Play'))
    expect(screen.queryByRole('group', { name: /circle of fifths/i })).toBeNull()
    expect(document.querySelector('svg.keyboard')).toBeTruthy()
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await play(q, 0)
    await screen.findByText(/Question 2 of 20/)
  })

  it('any other note is wrong, and the message gives the answer', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Play'))
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await play(q, 1)
    await waitFor(() => expect(message()).toMatch(/Not quite\. The answer is/))
  })

  it('can switch from the wheel to Play in the middle of a session', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await userEvent.click(button('Play'))
    await play(q, 0)
    await screen.findByText(/Question 2 of 20/)
  })
})
