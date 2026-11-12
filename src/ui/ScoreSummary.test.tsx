import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import type { RepResult } from '../session/types'
import { PianoDrillDB, Storage } from '../storage'
import { ScoreSummary, type ScoreSummaryProps } from './ScoreSummary'

let n = 0
let db: PianoDrillDB
let storage: Storage
beforeEach(() => {
  localStorage.clear()
  db = new PianoDrillDB(`summary-${++n}`)
  storage = new Storage(db)
})
afterEach(async () => {
  cleanup()
  db.close()
  await PianoDrillDB.delete(db.name)
})

const rep = (i: number, over: Partial<RepResult> = {}): RepResult =>
  ({
    sessionId: 'sess-1',
    mode: 'play',
    targetId: `t${i}`,
    outcome: 'correct',
    completionMs: 1000, // under the 2 s goal: full bonus, 200 points
    reactionMs: 800,
    errors: [],
    heard: [],
    timestamp: '2026-01-01T10:00:00.000Z',
    ...over,
  }) as RepResult

const results = (count: number, over: Partial<RepResult> = {}) =>
  Array.from({ length: count }, (_, i) => rep(i, over))

const show = (over: Partial<ScoreSummaryProps> = {}) =>
  render(
    <MemoryRouter>
      <ScoreSummary
        mode="play"
        levelId={3}
        levelName="Level 3: Test"
        goalSeconds={2}
        timeoutSeconds={10}
        plannedReps={5}
        results={results(5)}
        storage={storage}
        onClose={() => {}}
        onAgain={() => {}}
        {...over}
      />
    </MemoryRouter>,
  )

const scoreRec = (id: string, score: number) => ({
  id,
  mode: 'play' as const,
  level: '3',
  initials: 'OLD',
  score,
  correct: 5,
  reps: 5,
  totalMs: 5000,
  achievedAt: '2025-01-01T00:00:00Z',
})

describe('the score and totals', () => {
  it('shows the score out of the most possible, how many were right, and the total time', async () => {
    show()
    const dialog = screen.getByRole('dialog', { name: 'Session summary' })
    expect(within(dialog).getByLabelText('Score').textContent).toMatch(/^1,000 \/ 1,000/)
    // Nothing else until you ask for it.
    expect(within(dialog).queryByText(/correct/)).toBeNull()
    expect(within(dialog).queryByText(/Total time/)).toBeNull()
    await userEvent.hover(within(dialog).getByRole('button', { name: 'Score' }))
    expect(within(dialog).getByText(/5 of 5 correct \(100%\)/)).toBeTruthy()
    expect(within(dialog).getByText('Wrong notes: 0')).toBeTruthy()
    expect(within(dialog).queryByText(/Missed/)).toBeNull() // it is just the total minus the correct
    expect(within(dialog).getByText('Total time: 0:05')).toBeTruthy()
    await userEvent.unhover(within(dialog).getByRole('button', { name: 'Score' }))
    expect(within(dialog).queryByText(/correct/)).toBeNull()
    await waitFor(() => expect(screen.queryByText(/Could not save/)).toBeNull())
  })

  it('a slow, sloppy session scores less, and a tap keeps the breakdown open', async () => {
    show({
      results: [
        rep(0, { completionMs: 3000 }), // halfway down the bonus: 150
        rep(1, { outcome: 'timeout', completionMs: null }), // 0
        rep(2, { outcome: 'correct_with_errors', errors: [{ t: 1, notes: [61] }] }), // 200 - 25
        rep(3, { outcome: 'skipped', completionMs: null }),
        rep(4),
      ],
    })
    expect(screen.getByLabelText('Score').textContent).toMatch(/^525 \/ 1,000/)
    await userEvent.click(screen.getByRole('button', { name: 'Score' }))
    expect(screen.getByText(/3 of 5 correct \(60%\)/)).toBeTruthy()
    expect(screen.getByText('Wrong notes: 1')).toBeTruthy()
  })
})

describe('what is kept', () => {
  it('keeps only high scores: the session itself and its reps are not saved', async () => {
    show()
    await screen.findByText(/New high score! #1/)
    expect(await storage.listSessions()).toEqual([])
    expect(await storage.getReps('sess-1')).toEqual([])
    expect(await storage.topScores('play', '3')).toEqual([]) // not even the score until you enter initials
  })

  it('still shows the results, and says so, when storage cannot be used', async () => {
    const broken = {
      prospectiveRank: () => Promise.reject(new Error('no storage')),
    } as unknown as Storage
    show({ storage: broken })
    expect(screen.getByLabelText('Score').textContent).toMatch(/^1,000 \/ 1,000/)
    await screen.findByText(/Could not save/)
  })
})

describe('the high-score board', () => {
  it('asks for three initials on a new high score, then puts it on the board with its place', async () => {
    show()
    await screen.findByText(/New high score! #1/)
    expect(screen.getByText('on Level 3: Test')).toBeTruthy()
    const input = screen.getByLabelText(/Your initials/) as HTMLInputElement
    await userEvent.type(input, 'ab1c-dX')
    expect(input.value).toBe('ABC') // letters only, capitals, three at most
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/Saved! You are #1 on Level 3: Test/)
    const [top] = await storage.topScores('play', '3')
    expect(top).toMatchObject({
      initials: 'ABC',
      score: 1000,
      correct: 5,
      wrong: 0,
      reps: 5,
      totalMs: 5000,
    })
    expect(screen.queryByLabelText(/Your initials/)).toBeNull() // one entry per session
  })

  it('will not save without initials, and remembers them for next time', async () => {
    show()
    await screen.findByLabelText(/Your initials/)
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.type(screen.getByLabelText(/Your initials/), 'zed')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/Saved!/)
    cleanup()
    show({ results: results(5).map((r) => ({ ...r, sessionId: 'sess-2' })) })
    expect(((await screen.findByLabelText(/Your initials/)) as HTMLInputElement).value).toBe('ZED')
  })

  it('shows the place a score would take, among the others', async () => {
    await storage.addScore(scoreRec('a', 1200))
    await storage.addScore(scoreRec('b', 800))
    show()
    await screen.findByText(/New high score! #2/)
    await userEvent.type(screen.getByLabelText(/Your initials/), 'new')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByText(/Saved! You are #2/)
    expect((await storage.topScores('play', '3')).map((s) => s.initials)).toEqual([
      'OLD',
      'NEW',
      'OLD',
    ])
  })

  it('says so, and asks for nothing, when the score does not make the top ten', async () => {
    for (let i = 0; i < 10; i++) await storage.addScore(scoreRec(`s${i}`, 2000 + i))
    show()
    await screen.findByText(/Not in the top ten on Level 3: Test/)
    expect(screen.queryByLabelText(/Your initials/)).toBeNull()
    expect(await storage.topScores('play', '3')).toHaveLength(10)
  })

  it('custom setups and sessions ended early get no board', async () => {
    show({ levelId: 'custom', levelName: 'Custom' })
    await screen.findByText(/Only finished sessions on the preset levels/)
    expect(screen.queryByLabelText(/Your initials/)).toBeNull()
    cleanup()
    show({ results: results(3).map((r) => ({ ...r, sessionId: 'sess-3' })) }) // 3 of 5
    await screen.findByText(/Only finished sessions/)
    expect(screen.queryByLabelText(/Your initials/)).toBeNull()
    expect(await storage.topScores('play', '3')).toEqual([])
  })

  it('has one link to the high scores', () => {
    show()
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByRole('link', { name: /High scores/ }).getAttribute('href')).toBe('/scores')
  })
})
