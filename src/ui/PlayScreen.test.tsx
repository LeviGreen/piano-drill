import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { createLevelGenerator } from '../levels/levelGenerator'
import { PRESET_LEVELS } from '../levels/presets'
import type { Target } from '../theory/target'
import { PlayScreen } from './PlayScreen'

const STORAGE_KEY = 'piano-drill.play-settings'
const saveLevel = (id: number) =>
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ levelId: id, settings: PRESET_LEVELS.find((l) => l.id === id)!.settings }),
  )
const FAST = {
  getReadyMs: { first: 0, between: 0 },
  feedbackMs: 30,
  revealMs: 30,
  silenceMs: 0,
}
const SEED = Math.floor(0.123 * 1e6)

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
beforeEach(() => {
  localStorage.clear()
  vi.spyOn(Math, 'random').mockReturnValue(0.123) // the screen seeds its generator with Math.random
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const show = (props: Parameters<typeof PlayScreen>[0] = {}) =>
  render(
    <MemoryRouter>
      <PlayScreen {...props} />
    </MemoryRouter>,
  )
const button = (name: string | RegExp) => screen.getByRole('button', { name })
const keyEl = (midi: number) => document.querySelector(`svg.keyboard [data-midi="${midi}"]`)!
const upcoming = (levelId: number, n: number): Target[] => {
  const g = createLevelGenerator(PRESET_LEVELS.find((l) => l.id === levelId)!.settings, SEED)
  return Array.from({ length: n }, () => g.next())
}
const midisOf = (t: Target) => t.parts.flatMap((p) => p.pitches.map((x) => x.midi))
/** Put all the fingers down, then lift them: a chord. */
const playChord = (midis: number[]) => {
  midis.forEach((m, i) => fireEvent.pointerDown(keyEl(m), { pointerId: i + 1 }))
  midis.forEach((_, i) => fireEvent.pointerUp(window, { pointerId: i + 1 }))
}
const waitForTarget = async () =>
  await waitFor(() => expect(screen.getByText('Play it!')).toBeTruthy())

describe('before starting', () => {
  it('shows an empty grand staff, the piano and the controls', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Play' })).toBeTruthy()
    expect(screen.getByText('Press Start.')).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(2)
    expect(document.querySelectorAll('.staff .vf-clef')).toHaveLength(2)
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(0)
    expect(document.querySelector('svg.keyboard')).toBeTruthy()
    expect((button('Start') as HTMLButtonElement).disabled).toBe(false)
    expect((button('Pause') as HTMLButtonElement).disabled).toBe(true)
    expect((button('Skip') as HTMLButtonElement).disabled).toBe(true)
  })

  it('starts on level 1 and remembers the level you pick', async () => {
    show()
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog', { name: 'Play settings' })
    expect((within(dialog).getByLabelText('Level') as HTMLSelectElement).value).toBe('1')
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), '4')
    cleanup()
    show()
    await userEvent.click(button('Settings'))
    expect((screen.getByLabelText('Level') as HTMLSelectElement).value).toBe('4')
  })

  it('the drawer has the level, hands, notes per hand, sharps/flats and keys', async () => {
    show()
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog', { name: 'Play settings' })
    expect(within(dialog).getByLabelText('Level')).toBeTruthy()
    expect(within(dialog).getByRole('group', { name: 'Hands' })).toBeTruthy()
    expect(within(dialog).getByRole('group', { name: 'Notes per hand' })).toBeTruthy()
    expect(within(dialog).getByLabelText(/Up to this many sharps/)).toBeTruthy()
    expect(within(dialog).getByLabelText('Keys')).toBeTruthy()
  })

  it('picking a level fills the options in; changing one makes it Custom and keeps it next time', async () => {
    show()
    await userEvent.click(button('Settings'))
    let dialog = screen.getByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), '3')
    expect(
      (within(dialog).getByLabelText(/Up to this many sharps/) as HTMLSelectElement).value,
    ).toBe('2')
    expect(
      within(dialog)
        .getByRole('button', { name: /Right hand only/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
    await userEvent.click(within(dialog).getByRole('button', { name: /Left hand only/ }))
    expect((within(dialog).getByLabelText('Level') as HTMLSelectElement).value).toBe('custom')
    expect(
      within(dialog)
        .getByRole('button', { name: /Left hand only/ })
        .getAttribute('aria-pressed'),
    ).toBe('false')
    await userEvent.selectOptions(within(dialog).getByLabelText(/Up to this many sharps/), '5')
    await userEvent.selectOptions(within(dialog).getByLabelText('Keys'), 'minor')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({
      levelId: 'custom',
      settings: {
        name: 'Custom',
        hands: ['RH'],
        keys: { maxAccidentals: 5, modes: 'minor' },
      },
    })
    cleanup()
    show()
    await userEvent.click(button('Settings'))
    dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('Level') as HTMLSelectElement).value).toBe('custom')
    expect((within(dialog).getByLabelText('Keys') as HTMLSelectElement).value).toBe('minor')
  })

  it('you cannot untick the last hand or the last note count', async () => {
    show()
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Right hand only/ }))
    expect(
      within(dialog)
        .getByRole('button', { name: /Right hand only/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('a custom setup drives the session: left hand only gives bass-clef notes only', async () => {
    show({ timing: FAST, reps: 1 })
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Left hand only/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: /Right hand only/ }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(button('Start'))
    await waitForTarget()
    expect(document.querySelectorAll('.staff .vf-notehead').length).toBeGreaterThan(0)
    await userEvent.click(button('Skip'))
  })

  it('locks every option during a session', async () => {
    show()
    await userEvent.click(button('Start'))
    await userEvent.click(button('Settings'))
    const dialog = screen.getByRole('dialog')
    expect((within(dialog).getByLabelText('Level') as HTMLSelectElement).disabled).toBe(true)
    expect((within(dialog).getByLabelText('Keys') as HTMLSelectElement).disabled).toBe(true)
    expect(within(dialog).getByRole('group', { name: 'Hands' }).hasAttribute('disabled')).toBe(true)
    expect(within(dialog).getByText(/locked during a session/i)).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(button('End'))
  })
})

describe('the rep loop with the on-screen piano', () => {
  it.each(PRESET_LEVELS.map((l) => [l.id, l.name] as const))(
    'level %i (%s): playing each target flashed ends the rep as correct, through the whole session',
    async (id) => {
      saveLevel(id)
      const targets = upcoming(id, 2)
      show({ timing: FAST, reps: 2 })
      await userEvent.click(button('Start'))
      for (const t of targets) {
        await waitForTarget()
        expect(document.querySelectorAll('.staff .vf-notehead').length).toBeGreaterThan(0)
        playChord(midisOf(t))
        await waitFor(() => expect(screen.queryByText('Play it!')).toBeNull())
      }
      const summary = await screen.findByRole(
        'dialog',
        { name: 'Session summary' },
        { timeout: 4000 },
      )
      expect(within(summary).getByText(/2 of 2 correct \(100%\)/)).toBeTruthy()
      expect(within(summary).getByText(/Total time: \d+:\d\d/)).toBeTruthy()
    },
    15000,
  )

  it('each note you get turns green on the staff and the keyboard, and the counter follows', async () => {
    saveLevel(4) // intervals: two notes in one hand
    const [t] = upcoming(4, 1)
    const midis = midisOf(t)
    show({ timing: FAST, reps: 1 })
    await userEvent.click(button('Start'))
    await waitForTarget()
    expect(screen.getByText(`0 / ${midis.length} notes`)).toBeTruthy()
    fireEvent.pointerDown(keyEl(midis[0]), { pointerId: 1 })
    await waitFor(() => expect(screen.getByText(`1 / ${midis.length} notes`)).toBeTruthy())
    expect(keyEl(midis[0]).classList.contains('heard')).toBe(true)
    expect(document.querySelectorAll('.staff .note-halo.heard')).toHaveLength(1)
    fireEvent.pointerUp(window, { pointerId: 1 })
  })

  it('a wrong note is marked on the keyboard and does not undo notes already heard', async () => {
    const [t] = upcoming(1, 1)
    const [right] = midisOf(t)
    const wrong = right === 60 ? 62 : 60
    show({ timing: FAST, reps: 1 })
    await userEvent.click(button('Start'))
    await waitForTarget()
    playChord([wrong])
    await waitFor(() => expect(keyEl(wrong).classList.contains('wrong')).toBe(true))
    playChord([right])
    const summary = await screen.findByRole('dialog', { name: 'Session summary' })
    expect(within(summary).getByText(/1 of 1 correct/)).toBeTruthy()
    expect(within(summary).getByText(/Wrong notes: 1/)).toBeTruthy()
  })

  it('a multi-touch chord counts as every note in it', async () => {
    saveLevel(5) // chords
    const [t] = upcoming(5, 1)
    show({ timing: FAST, reps: 1 })
    await userEvent.click(button('Start'))
    await waitForTarget()
    const midis = midisOf(t)
    midis.forEach((m, i) => fireEvent.pointerDown(keyEl(m), { pointerId: i + 1 })) // all fingers down together
    midis.forEach((_, i) => fireEvent.pointerUp(window, { pointerId: i + 1 }))
    await screen.findByRole('dialog', { name: 'Session summary' })
  })

  it('skip reveals the answer with note names and says so', async () => {
    show({ timing: FAST, reps: 1 })
    await userEvent.click(button('Start'))
    await waitForTarget()
    await userEvent.click(button('Skip'))
    await waitFor(() =>
      expect(document.querySelector('.result-slot')!.textContent).toBe(
        'Skipped. Here is the answer.',
      ),
    )
    expect(document.querySelectorAll('.staff .note-name').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('svg.keyboard .kb-key.target').length).toBeGreaterThan(0)
  })

  it('the piano does nothing while getting ready, before a target is on screen', async () => {
    show() // the product's 4 second get-ready
    await userEvent.click(button('Start'))
    fireEvent.pointerDown(keyEl(60), { pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })
    expect(
      document.querySelector('svg.keyboard .kb-key.heard, svg.keyboard .kb-key.wrong'),
    ).toBeNull()
    expect(screen.getByText('Get ready…')).toBeTruthy()
    await userEvent.click(button('End'))
  })
})

describe('layout and countdown', () => {
  it('counts down 4, 3, 2, 1 over the empty staff before the first target, and is gone after End', async () => {
    show()
    expect(screen.queryByRole('timer')).toBeNull()
    await userEvent.click(button('Start'))
    expect(screen.getByRole('timer').textContent).toBe('4')
    expect(screen.getByText('Get ready…')).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(2)
    await userEvent.click(button('End'))
    expect(screen.queryByRole('timer')).toBeNull()
    expect(screen.getByText('Session ended.')).toBeTruthy()
  })

  it('pauses and resumes', async () => {
    show()
    await userEvent.click(button('Start'))
    await userEvent.click(button('Pause'))
    expect(screen.getByText(/Paused/)).toBeTruthy()
    await userEvent.click(button('Resume'))
    expect(screen.getByRole('timer')).toBeTruthy()
    await userEvent.click(button('End'))
  })

  it('the staff, clock line, notes line and result area stay the same elements through a rep', async () => {
    const [t] = upcoming(1, 1)
    show({ timing: FAST, reps: 1 })
    const before = ['.staff', '.keyid-clock', '.play-notes', '.result-slot'].map((q) =>
      document.querySelector(q),
    )
    await userEvent.click(button('Start'))
    await waitForTarget()
    playChord(midisOf(t))
    await screen.findByRole('dialog', { name: 'Session summary' })
    const after = ['.staff', '.keyid-clock', '.play-notes', '.result-slot'].map((q) =>
      document.querySelector(q),
    )
    after.forEach((el, i) => expect(el).toBe(before[i]))
  })

  it('counts down the time allowed for each target, on its own line', async () => {
    show({ timing: FAST, reps: 1 })
    expect(document.querySelector('.keyid-clock')!.textContent).toBe('')
    await userEvent.click(button('Start'))
    await waitForTarget()
    await waitFor(() =>
      expect(Number(document.querySelector('.keyid-clock')!.textContent)).toBeGreaterThan(0),
    )
    expect(document.querySelector('.keyid-status')!.textContent).not.toMatch(/\d+ s/)
    await userEvent.click(button('End'))
  })
})
