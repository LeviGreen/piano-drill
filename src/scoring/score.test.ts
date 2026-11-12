import { describe, expect, it } from 'vitest'
import type { RepResult } from '../session/types'
import { correctCount, maxScore, sessionScore, targetScore, totalTimeMs } from './score'

const rep = (over: Partial<RepResult> = {}): RepResult =>
  ({
    outcome: 'correct',
    completionMs: 1000,
    errors: [],
    ...over,
  }) as RepResult

describe('a target is worth 100, plus a speed bonus of up to 100', () => {
  it('full bonus at or under the goal time', () => {
    expect(targetScore(rep({ completionMs: 500 }), 2)).toBe(200)
    expect(targetScore(rep({ completionMs: 2000 }), 2)).toBe(200)
  })

  it('the bonus fades to nothing at twice the goal time, and stays at 100 beyond', () => {
    expect(targetScore(rep({ completionMs: 3000 }), 2)).toBe(150) // halfway
    expect(targetScore(rep({ completionMs: 4000 }), 2)).toBe(100)
    expect(targetScore(rep({ completionMs: 9000 }), 2)).toBe(100)
  })

  it('a faster time never scores less than a slower one', () => {
    let last = Infinity
    for (let ms = 0; ms <= 6000; ms += 250) {
      const s = targetScore(rep({ completionMs: ms }), 2)
      expect(s).toBeLessThanOrEqual(last)
      last = s
    }
  })
})

describe('mistakes and misses', () => {
  it('each wrong note costs 25, and a target never goes below 0', () => {
    const wrong = (n: number) => Array.from({ length: n }, () => ({ t: 1, notes: [61] }))
    expect(targetScore(rep({ outcome: 'correct_with_errors', errors: wrong(2) }), 2)).toBe(150)
    expect(
      targetScore(
        rep({ outcome: 'correct_with_errors', completionMs: 9000, errors: wrong(10) }),
        2,
      ),
    ).toBe(0)
  })

  it.each(['timeout', 'skipped', 'incorrect'] as const)('%s scores 0', (outcome) => {
    expect(targetScore(rep({ outcome, completionMs: null }), 2)).toBe(0)
  })
})

describe('a session', () => {
  it('adds up its targets; a perfect fast 20-target session is 4000', () => {
    const perfect = Array.from({ length: 20 }, () => rep({ completionMs: 800 }))
    expect(sessionScore(perfect, 2)).toBe(4000)
    expect(maxScore(20)).toBe(4000)
    expect(
      sessionScore(
        [rep({ completionMs: 800 }), rep({ outcome: 'timeout', completionMs: null })],
        2,
      ),
    ).toBe(200)
  })

  it('counts the correct ones, with or without stray notes', () => {
    expect(
      correctCount([
        rep(),
        rep({ outcome: 'correct_with_errors' }),
        rep({ outcome: 'timeout' }),
        rep({ outcome: 'incorrect' }),
      ]),
    ).toBe(2)
  })

  it('in key ID each wrong guess costs 25 too, and a question solved after guessing takes until it was solved', () => {
    const solvedAfterTwoWrong = rep({
      mode: 'keyid',
      outcome: 'correct_with_errors',
      completionMs: 1500,
      errors: [
        { t: 300, notes: [] },
        { t: 900, notes: [] },
      ],
    })
    expect(targetScore(solvedAfterTwoWrong, 2)).toBe(150)
    expect(
      totalTimeMs(
        [solvedAfterTwoWrong, rep({ mode: 'keyid', outcome: 'timeout', completionMs: null })],
        5,
      ),
    ).toBe(6500)
  })

  it('total time counts a timeout as the full time limit, and nothing for no limit', () => {
    const rs = [rep({ completionMs: 1500 }), rep({ outcome: 'timeout', completionMs: null })]
    expect(totalTimeMs(rs, 10)).toBe(11500)
    expect(totalTimeMs(rs, null)).toBe(1500)
  })
})
