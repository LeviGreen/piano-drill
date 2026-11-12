import { describe, expect, it } from 'vitest'
import { confusions, summarize } from './summary'
import type { RepOutcome, RepResult } from './types'

const rep = (over: Partial<RepResult> & { outcome: RepOutcome }): RepResult => ({
  sessionId: 's',
  mode: 'play',
  targetId: 't',
  dims: { hands: 'RH', clef: 'treble', key: 'C major', noteCount: 1, contentType: 'note' },
  reactionMs: 1000,
  completionMs: over.outcome === 'correct' || over.outcome === 'correct_with_errors' ? 1000 : null,
  errors: [],
  heard: [],
  startedWithoutSilence: false,
  timestamp: '',
  ...over,
})

/** A key-ID rep where each of `wrong` was guessed (in order) before the question ended. */
const keyIdRep = (
  correct: number,
  wrong: number[],
  outcome: RepOutcome = 'correct_with_errors',
): RepResult =>
  rep({
    mode: 'keyid',
    outcome,
    keyId: {
      format: 'major',
      correct: { accidentals: correct, mode: 'major' },
      given:
        outcome === 'timeout' || outcome === 'skipped'
          ? null
          : { accidentals: correct, mode: 'major' },
      wrong: wrong.map((w) => ({ accidentals: w, mode: 'major' as const })),
      wrongPlayed: [],
      method: 'tap',
    },
  })

describe('summarize', () => {
  it('counts outcomes and accuracy across both modes', () => {
    const s = summarize([
      rep({ outcome: 'correct' }),
      rep({ outcome: 'correct_with_errors' }),
      rep({ outcome: 'incorrect' }),
      rep({ outcome: 'timeout' }),
      rep({ outcome: 'skipped' }),
    ])
    expect(s).toMatchObject({
      reps: 5,
      correct: 2,
      incorrect: 1,
      timedOut: 1,
      skipped: 1,
      accuracy: 0.4,
    })
  })

  it('median and mean come from reps completed correctly only', () => {
    const s = summarize([
      rep({ outcome: 'correct', completionMs: 1000, targetId: 'a' }),
      rep({ outcome: 'correct', completionMs: 3000, targetId: 'b' }),
      rep({ outcome: 'correct', completionMs: 2000, targetId: 'c' }),
      rep({ outcome: 'timeout' }),
    ])
    expect(s.medianMs).toBe(2000)
    expect(s.meanMs).toBe(2000)
    expect(s.slowest.map((x) => x.targetId)).toEqual(['b', 'c', 'a'])
  })

  it('takes the middle of two for an even count, and copes with nothing at all', () => {
    expect(
      summarize([
        rep({ outcome: 'correct', completionMs: 1000 }),
        rep({ outcome: 'correct', completionMs: 2000 }),
      ]).medianMs,
    ).toBe(1500)
    expect(summarize([])).toMatchObject({
      reps: 0,
      accuracy: 0,
      medianMs: null,
      meanMs: null,
      slowest: [],
    })
    expect(summarize([rep({ outcome: 'timeout' })]).medianMs).toBeNull()
  })
})

describe('confusions (guessed versus right)', () => {
  it('counts each wrong guess, most frequent first, in plain words', () => {
    const list = confusions([
      keyIdRep(-3, [-4]),
      keyIdRep(-3, [-4]),
      keyIdRep(-3, [-2]),
      keyIdRep(2, [3]),
      keyIdRep(-3, [-4]),
    ])
    expect(list).toEqual([
      { correct: 'E♭ major', given: 'A♭ major', count: 3 },
      { correct: 'D major', given: 'A major', count: 1 },
      { correct: 'E♭ major', given: 'B♭ major', count: 1 },
    ])
  })

  it('counts every wrong guess on a question that took several tries, including ones that then timed out', () => {
    const list = confusions([keyIdRep(2, [3, 4, 3]), keyIdRep(-3, [-2], 'timeout')])
    expect(list).toEqual([
      { correct: 'D major', given: 'A major', count: 2 },
      { correct: 'D major', given: 'E major', count: 1 },
      { correct: 'E♭ major', given: 'B♭ major', count: 1 },
    ])
  })

  it('ignores right first tries, plain timeouts and skips, and play-mode reps', () => {
    expect(
      confusions([
        keyIdRep(-3, [], 'correct'),
        keyIdRep(-3, [], 'timeout'),
        keyIdRep(-3, [], 'skipped'),
        rep({ outcome: 'incorrect' }),
      ]),
    ).toEqual([])
  })
})
