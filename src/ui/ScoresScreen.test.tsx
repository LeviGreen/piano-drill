import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { PianoDrillDB, Storage } from '../storage'
import { ScoresScreen } from './ScoresScreen'

let n = 0
let db: PianoDrillDB
let storage: Storage
beforeEach(() => {
  db = new PianoDrillDB(`scores-${++n}`)
  storage = new Storage(db)
})
afterEach(async () => {
  cleanup()
  db.close()
  await PianoDrillDB.delete(db.name)
})

const show = (url = '/') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <ScoresScreen storage={storage} />
    </MemoryRouter>,
  )
const addScore = (
  id: string,
  mode: 'play' | 'keyid',
  level: string,
  initials: string,
  score: number,
) =>
  storage.addScore({
    id,
    mode,
    level,
    initials,
    score,
    correct: 18,
    wrong: 4,
    reps: 20,
    totalMs: 95000,
    achievedAt: '2026-03-04T10:00:00Z',
  })

describe('high scores', () => {
  it('Sight-Read has a key picker above the level picker: several keys, then each key signature, with its own board', async () => {
    await storage.addScore({
      id: 'k',
      mode: 'play',
      level: '2',
      keySignature: -3,
      initials: 'EFL',
      score: 3000,
      correct: 18,
      reps: 20,
      totalMs: 95000,
      achievedAt: '2026-03-04T10:00:00Z',
    })
    await addScore('s', 'play', '2', 'SEV', 2000)
    show()
    const key = (await screen.findByLabelText('Key')) as HTMLSelectElement
    const level = screen.getByLabelText('Level')
    expect(key.compareDocumentPosition(level) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect([...key.options].map((o) => o.textContent)).toEqual([
      'Several keys',
      ...Array.from({ length: 15 }, () => expect.any(String)),
    ])
    expect(key.options[1].textContent).toBe('C♭ major / A♭ minor (7 flats)')
    await userEvent.selectOptions(level, '2')
    expect(await screen.findByText('SEV')).toBeTruthy()
    expect(screen.queryByText('EFL')).toBeNull()
    await userEvent.selectOptions(key, '-3')
    expect(await screen.findByText('EFL')).toBeTruthy()
    expect(screen.queryByText('SEV')).toBeNull()
  })

  it('Key Signatures has no key picker, but keeps its place so the board does not move; switching resets both pickers', async () => {
    show()
    const key = await screen.findByLabelText('Key')
    await userEvent.selectOptions(key, '2')
    await userEvent.click(screen.getByRole('button', { name: 'Key Signatures' }))
    expect(key.closest('.unused')).not.toBeNull() // still in the layout, not seen
    expect(screen.getByLabelText('Level')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Sight-Read' }))
    expect((screen.getByLabelText('Key') as HTMLSelectElement).value).toBe('several')
    expect(screen.getByLabelText('Key').closest('.unused')).toBeNull()
  })

  it("a link with a key (?key=-3) opens that key's board", async () => {
    show('/scores?mode=play&level=1&key=-3')
    expect(((await screen.findByLabelText('Key')) as HTMLSelectElement).value).toBe('-3')
  })

  it('an empty level still shows a board of ten blank lines, numbered 1 to 10', async () => {
    show()
    const rows = await screen.findAllByRole('row')
    expect(rows).toHaveLength(11) // header + ten
    expect(rows.slice(1).map((r) => r.querySelector('td')?.textContent)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 1)),
    )
    expect(screen.queryByText(/No scores yet/)).toBeNull()
  })

  it('fills the top lines with the scores there are, and leaves the rest blank up to ten', async () => {
    await addScore('a', 'play', '1', 'AAA', 1000)
    await addScore('b', 'play', '1', 'BBB', 2000)
    await addScore('c', 'play', '1', 'CCC', 3000)
    show()
    await screen.findByText('CCC')
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(11)
    expect(rows.slice(1, 4).map((r) => r.querySelector('.initials')?.textContent)).toEqual([
      'CCC',
      'BBB',
      'AAA',
    ])
    expect(rows.slice(4).every((r) => r.classList.contains('blank'))).toBe(true)
  })

  it('blank lines have the same seven cells as filled ones, so the columns line up', async () => {
    await addScore('a', 'play', '1', 'AAA', 1000)
    show()
    await screen.findByText('AAA')
    for (const row of screen.getAllByRole('row').slice(1)) expect(row.children).toHaveLength(7)
    expect(document.querySelectorAll('.board th')).toHaveLength(7)
  })

  it('a full board has no blank lines', async () => {
    for (let i = 1; i <= 10; i++) await addScore(`s${i}`, 'play', '1', 'FUL', i * 100)
    show()
    await screen.findAllByText('FUL')
    expect(document.querySelectorAll('.board tr.blank')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(11)
  })

  it("shows a level's board best first, with initials, score, correct, time and date", async () => {
    await addScore('a', 'play', '1', 'LOW', 1500)
    await addScore('b', 'play', '1', 'TOP', 3500)
    show()
    await screen.findByText('TOP')
    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(11) // header + ten lines, two of them filled
    expect(within(rows[1]).getByText('TOP')).toBeTruthy()
    expect(within(rows[1]).getByText('3,500')).toBeTruthy()
    expect(within(rows[1]).getByText('18 / 20')).toBeTruthy()
    expect(within(rows[1]).getByText('4')).toBeTruthy() // wrong notes or guesses
    expect(within(rows[1]).getByText('1:35')).toBeTruthy()
    expect(within(rows[1]).getByText('2026-03-04')).toBeTruthy()
    expect(within(rows[2]).getByText('LOW')).toBeTruthy()
  })

  it('has a board for each level and each mode', async () => {
    await addScore('a', 'play', '1', 'ONE', 1000)
    await addScore('b', 'play', '4', 'FOR', 2000)
    await addScore('c', 'keyid', '1', 'KEY', 3000)
    show()
    await screen.findByText('ONE')
    await userEvent.selectOptions(screen.getByLabelText('Level'), '4')
    await screen.findByText('FOR')
    expect(screen.queryByText('ONE')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Key Signatures' }))
    await screen.findByText('KEY')
    expect(screen.queryByText('FOR')).toBeNull()
    expect(screen.getAllByRole('option')).toHaveLength(5) // the five key-ID levels
  })
})

describe('on a phone', () => {
  const setPhone = (on: boolean) =>
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: on && query === '(max-width: 640px)',
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
  beforeEach(() => setPhone(true))
  afterEach(() => {
    // @ts-expect-error back to a browser with no matchMedia, which the other tests assume
    delete window.matchMedia
  })

  it('the board has only #, initials, score and date', async () => {
    await addScore('a', 'play', '1', 'TOP', 3500)
    show()
    await screen.findByText('TOP')
    expect([...document.querySelectorAll('.board th')].map((th) => th.textContent)).toEqual([
      '#',
      'Initials',
      'Score',
      'Date',
    ])
    for (const row of screen.getAllByRole('row').slice(1)) expect(row.children).toHaveLength(4)
    expect(screen.getAllByRole('row')).toHaveLength(11) // still ten lines
    expect(document.querySelector('.board')?.classList.contains('compact')).toBe(true)
  })

  it('tapping the score opens a pop-up with the breakdown, which closes again', async () => {
    await addScore('a', 'play', '1', 'TOP', 3500)
    show()
    await userEvent.click(await screen.findByRole('button', { name: /3,500, show details/ }))
    const popup = screen.getByRole('dialog')
    expect(within(popup).getByText('18 of 20 correct (90%)')).toBeTruthy()
    expect(within(popup).getByText('Wrong notes: 4')).toBeTruthy()
    expect(within(popup).getByText('Total time: 1:35')).toBeTruthy()
    expect(within(popup).getByText('2026-03-04')).toBeTruthy()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Key Signatures boards say wrong guesses', async () => {
    await addScore('k', 'keyid', '1', 'KEY', 2000)
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Key Signatures' }))
    await userEvent.click(await screen.findByRole('button', { name: /2,000, show details/ }))
    expect(within(screen.getByRole('dialog')).getByText('Wrong guesses: 4')).toBeTruthy()
  })

  it('on a wide screen the score is plain text and the full table shows', async () => {
    setPhone(false)
    await addScore('a', 'play', '1', 'TOP', 3500)
    show()
    await screen.findByText('TOP')
    expect(screen.queryByRole('button', { name: /show details/ })).toBeNull()
    expect(document.querySelectorAll('.board th')).toHaveLength(7)
  })

  it('opens on the mode and level in the link, and falls back quietly on a bad one', async () => {
    show('/scores?mode=keyid&level=3')
    expect(
      screen.getByRole('button', { name: 'Key Signatures' }).getAttribute('aria-pressed'),
    ).toBe('true')
    expect((screen.getByLabelText('Level') as HTMLSelectElement).value).toBe('3')
    await screen.findAllByRole('row')
    cleanup()
    show('/scores?mode=bogus&level=99')
    expect(screen.getByRole('button', { name: 'Sight-Read' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect((screen.getByLabelText('Level') as HTMLSelectElement).value).toBe('1')
    await screen.findAllByRole('row')
  })
})
