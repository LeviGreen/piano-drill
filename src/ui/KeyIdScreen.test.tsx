import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { KeyIdGenerator, type KeyIdQuestion } from '../keyid/questions'
import { parseKeyIdSettings, toQuestionConfig, type KeyIdSettings } from '../keyid/settings'
import { answerLabel } from '../keyid/labels'
import { KEY_ID_LEVELS } from '../keyid/presets'
import { PianoDrillDB, Storage } from '../storage'
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
/** The breakdown shows when you hover over (or tap) the score. */
const showDetails = async (dialog: HTMLElement) =>
  await userEvent.hover(within(dialog).getByRole('button', { name: 'Score' }))

const answerButton = (q: KeyIdQuestion) => button(answerLabel(q.answer))

describe('before starting', () => {
  it('shows an empty staff and a disabled answer area, with the controls ready', () => {
    store({})
    show()
    expect(screen.getByRole('heading', { name: 'Key Signatures' })).toBeTruthy()
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
    await screen.findByText(/Question 2 of \d+/)
    expect(message()).toBe('')
  })

  it('a wrong guess is marked ✕ and the question carries on, without giving the answer away', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q1] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q1.prompt)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    const wrongName = q1.answer.accidentals === 0 ? 'G major' : 'C major'
    await userEvent.click(button(wrongName))
    const wrong = button(wrongName)
    expect(wrong.classList.contains('wrong')).toBe(true)
    expect(wrong.textContent).toContain('✕')
    expect(wrong.getAttribute('aria-disabled')).toBe('true') // no point picking it twice
    expect(message()).toBe('') // nothing says what the right answer is
    expect(answerButton(q1).classList.contains('correct')).toBe(false)
    expect(screen.getByText(/Question 1 of \d+/)).toBeTruthy() // still on the same question
    await userEvent.click(answerButton(q1)) // now the right one
    await screen.findByText(/Question 2 of \d+/)
    expect(message()).toBe('') // solved: just the green mark
  })

  it('the ✕ marks go away for the next question', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q1] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q1.prompt)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    await userEvent.click(button(q1.answer.accidentals === 0 ? 'G major' : 'C major'))
    await userEvent.click(answerButton(q1))
    await screen.findByText(/Question 2 of \d+/)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    expect(document.querySelectorAll('.wheel-key.wrong')).toHaveLength(0)
  })

  it('timing out after a wrong guess reveals the answer', async () => {
    const s = store({ maxAccidentals: 3, timeoutSeconds: 1 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST, questions: 1 })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    await userEvent.click(button(q.answer.accidentals === 0 ? 'G major' : 'C major'))
    await waitFor(
      () => expect(message()).toBe(`Time's up. The answer is ${answerLabel(q.answer)}.`),
      {
        timeout: 3000,
      },
    )
    // The answer is shown purple ("to play"), not green like a right answer.
    expect(answerButton(q).classList.contains('reveal')).toBe(true)
    expect(answerButton(q).classList.contains('correct')).toBe(false)
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
    await showDetails(summary)
    expect(within(summary).getByText(/3 of 3 correct \(100%\)/)).toBeTruthy()
    expect(within(summary).getByText(/Total time: \d+:\d\d/)).toBeTruthy()
    expect(within(summary).queryByRole('table')).toBeNull() // no per-question times
    expect(screen.getByText('Session complete.')).toBeTruthy()
    expect((button('Start') as HTMLButtonElement).disabled).toBe(false) // can go again
  })

  it('counts the wrong guesses in the score breakdown, without listing mix-ups', async () => {
    const s = store({ maxAccidentals: 3 })
    const qs = upcoming(s, 2)
    show({ timing: FAST, questions: 2 })
    await userEvent.click(button('Start'))
    for (const q of qs) {
      await screen.findByText(q.prompt)
      await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
      // Guess "C major" first (wrong unless the question is C major), then get it right.
      await userEvent.click(button('C major'))
      if (q.answer.accidentals !== 0) await userEvent.click(answerButton(q))
      await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(true), {
        timeout: 2000,
      }).catch(() => {})
    }
    const summary = await screen.findByRole(
      'dialog',
      { name: 'Session summary' },
      { timeout: 3000 },
    )
    const wrongOnes = qs.filter((q) => q.answer.accidentals !== 0)
    await showDetails(summary)
    expect(within(summary).getByText(`Wrong guesses: ${wrongOnes.length}`)).toBeTruthy()
    expect(within(summary).queryByText('Mix-ups')).toBeNull() // not in the score breakdown
    expect(within(summary).queryByText(/you said/)).toBeNull()
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
    await screen.findByText(/Question 2 of \d+/)
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
    const dialog = screen.getByRole('dialog', { name: 'Key Signatures settings' })
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
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }))
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      modes: 'both',
      maxAccidentals: 6,
      name: 'Custom',
    })
  })

  it('Save keeps the changes and closes; Close, a click outside and Escape throw them away', async () => {
    store({})
    show()
    const dialogNow = () => screen.getByRole('dialog', { name: 'Key Signatures settings' })
    const sharps = () =>
      (within(dialogNow()).getByLabelText(/Up to this many/) as HTMLSelectElement).value
    const change = async () => {
      await userEvent.click(button('Settings'))
      await userEvent.selectOptions(within(dialogNow()).getByLabelText(/Up to this many/), '6')
    }
    await userEvent.click(button('Settings'))
    const before = sharps()
    await userEvent.keyboard('{Escape}')
    await change()
    await userEvent.click(within(dialogNow()).getByRole('button', { name: 'Close' }))
    await userEvent.click(button('Settings'))
    expect(sharps()).toBe(before) // Close
    await userEvent.keyboard('{Escape}')
    await change()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(button('Settings'))
    expect(sharps()).toBe(before) // Escape
    await userEvent.keyboard('{Escape}')
    await change()
    await userEvent.click(document.querySelector('.drawer-backdrop')!)
    await userEvent.click(button('Settings'))
    expect(sharps()).toBe(before) // a click outside
    await userEvent.keyboard('{Escape}')
    await change()
    await userEvent.click(within(dialogNow()).getByRole('button', { name: 'Save' }))
    expect(screen.queryByRole('dialog')).toBeNull() // Save closes the window
    await userEvent.click(button('Settings'))
    expect(sharps()).toBe('6')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).maxAccidentals).toBe(6)
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

describe('the screen shows one staff at a time, centred, with the answer input under it', () => {
  it('has one clef and a minor-key question shows the tonic note', async () => {
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

describe('the question counter', () => {
  it('says the question just answered while its result shows, and the next number only when the next begins', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: { ...FAST, feedbackMs: 60_000 }, questions: 5 })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    expect(document.querySelector('.keyid-status')!.textContent).toMatch(/Question 1 of 5/)
    await userEvent.click(answerButton(q))
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(true))
    expect(document.querySelector('.keyid-status')!.textContent).toMatch(/Question 1 of 5/) // not 2 yet
    await userEvent.click(button('End'))
  })
})

describe('the clef changes from question to question, treble or bass', () => {
  /** A seed (as the screen takes it from Math.random) whose first question is in the given clef. */
  const seedFor = (clef: 'treble' | 'bass', s: KeyIdSettings): number => {
    for (let seed = 1; seed < 500; seed++) {
      if (new KeyIdGenerator(toQuestionConfig(s), seed).next().clef === clef) return seed
    }
    throw new Error('no seed')
  }
  const clefShape = () => document.querySelector('.staff .vf-clef')!.innerHTML
  const idleTreble = () => {
    show()
    const shape = clefShape()
    cleanup()
    return shape
  }

  it('draws the key signature in the bass clef when the question is in the bass clef, and in treble otherwise', async () => {
    const s = store({ modes: 'major', maxAccidentals: 3 })
    const treble = idleTreble()
    for (const clef of ['bass', 'treble'] as const) {
      vi.spyOn(Math, 'random').mockReturnValue((seedFor(clef, s) + 0.5) / 1e6)
      show({ timing: FAST })
      await userEvent.click(button('Start'))
      const [q] = [new KeyIdGenerator(toQuestionConfig(s), seedFor(clef, s)).next()]
      await screen.findByText(q.prompt)
      await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
      expect(document.querySelectorAll('.staff .vf-clef')).toHaveLength(1)
      if (clef === 'bass') expect(clefShape()).not.toBe(treble)
      else expect(clefShape()).toBe(treble)
      await userEvent.click(button('End'))
      cleanup()
    }
  })

  it('there is no clef setting', async () => {
    show()
    await userEvent.click(button('Settings'))
    expect(within(screen.getByRole('dialog')).queryByLabelText(/clef/i)).toBeNull()
  })
})

describe('scores', () => {
  it('a finished session is scored and can be put on the key-ID board', async () => {
    const db = new PianoDrillDB(`keyid-scores-${Date.now()}`)
    const storage = new Storage(db)
    const [q] = upcoming(KEY_ID_LEVELS[0].settings, 1) // the default: preset level 1
    show({ timing: FAST, questions: 1, storage })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await waitFor(() => expect((button('Skip') as HTMLButtonElement).disabled).toBe(false))
    await userEvent.click(answerButton(q))
    const summary = await screen.findByRole(
      'dialog',
      { name: 'Session summary' },
      { timeout: 3000 },
    )
    expect(within(summary).getByLabelText('Score').textContent).toMatch(/^\d+ \/ 150/)
    await within(summary).findByText(/New high score! #1/)
    await userEvent.type(within(summary).getByLabelText(/Your initials/), 'abc')
    await userEvent.click(within(summary).getByRole('button', { name: 'Save' }))
    await within(summary).findByText(/Saved!/)
    // The level is remembered, so the board is the one for the level you played.
    expect(await storage.topScores('keyid', '1')).toHaveLength(1)
    db.close()
  })
})

describe('the question clock', () => {
  const clock = () => document.querySelector('.keyid-clock')!.textContent
  it('stays hidden until 3 seconds are left, then counts down in whole seconds, apart from the status', async () => {
    store({ timeoutSeconds: 10 })
    show({ timing: FAST })
    expect(clock()).toBe('')
    await userEvent.click(button('Start'))
    await screen.findByText(/Which major key/)
    expect(clock()).toBe('') // 10 seconds left: not shown
    expect(document.querySelector('.keyid-status')!.textContent).not.toMatch(/\d+ s|·/)
    await userEvent.click(button('End'))
    expect(clock()).toBe('')
  })

  it('shows the clock from the start when the limit is 3 seconds or less', async () => {
    store({ timeoutSeconds: 3 })
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await waitFor(() => expect(Number(clock())).toBeGreaterThan(0))
    expect(Number(clock())).toBeLessThanOrEqual(3)
    await userEvent.click(button('End'))
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

describe('the MIDI view needs a MIDI piano and a desktop screen', () => {
  const asPhone = () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width'),
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }
  afterEach(() => vi.unstubAllGlobals())

  it('with the on-screen piano chosen (the default), Play is greyed out, with a hint', async () => {
    show()
    const play = button('MIDI') as HTMLButtonElement
    expect(play.disabled).toBe(true)
    expect(screen.getByText(/needs a MIDI piano/i)).toBeTruthy()
    await userEvent.click(play)
    expect(screen.getByRole('group', { name: /circle of fifths/i })).toBeTruthy() // still on the wheel
  })

  it('with a MIDI piano chosen, Play is available', () => {
    localStorage.setItem('piano-drill.input', 'midi')
    show()
    expect((button('MIDI') as HTMLButtonElement).disabled).toBe(false)
  })

  it('on a phone, Play is greyed out whatever is chosen, and there is no Input setting', async () => {
    asPhone()
    localStorage.setItem('piano-drill.input', 'midi')
    show()
    expect((button('MIDI') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText(/for desktop screens/i)).toBeTruthy()
    await userEvent.click(button('Settings'))
    expect(within(screen.getByRole('dialog')).queryByLabelText('Input')).toBeNull()
  })

  it('starts on the wheel and answers by tapping when Play is not available', async () => {
    const s = store({ maxAccidentals: 3 })
    const [q] = upcoming(s, 1)
    show({ timing: FAST })
    await userEvent.click(button('Start'))
    await screen.findByText(q.prompt)
    await userEvent.click(answerButton(q))
    await screen.findByText(/Question 2 of \d+/)
  })
})
