import { describe, expect, it } from 'vitest'
import { ScriptedInput } from '../audio/inputs/ScriptedInput'
import type { Presenter } from '../session/types'
import { FakeClock } from '../test-utils/fakeClock'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import { scaleNotes } from './scalePlay'
import { KeyIdSession, type KeyIdSessionOptions, type KeyIdSnapshot } from './KeyIdSession'
import {
  correctAnswer,
  DEFAULT_KEY_ID_CONFIG,
  KeyIdGenerator,
  type KeyIdFormat,
  type KeyIdQuestion,
} from './questions'

/** A question about E♭ major (3 flats), in the format asked. */
function question(
  id: string,
  format: KeyIdFormat = 'major',
  accidentals = -3,
  mode: 'major' | 'minor' = 'major',
): KeyIdQuestion {
  const key = keySignature(accidentals, mode)
  return {
    id,
    key,
    clef: 'treble',
    accidentals,
    format,
    hint: null,
    prompt: '',
    answer: correctAnswer(format, key),
  }
}

function fakePresenter(clock: FakeClock) {
  const log: string[] = []
  const p: Presenter<KeyIdQuestion> & { log: string[] } = {
    log,
    prepare: (q) => void log.push(`prepare ${q.id}`),
    flash: (q) =>
      new Promise((resolve) => {
        log.push(`flash ${q.id}`)
        clock.setTimeout(() => resolve(clock.now()), 3)
      }),
    reveal: (q) => void log.push(`reveal ${q.id}`),
    clear: () => void log.push('clear'),
  }
  return p
}

function rig(over: Partial<KeyIdSessionOptions> = {}, questions: KeyIdQuestion[] = []) {
  const clock = new FakeClock()
  const presenter = fakePresenter(clock)
  let n = 0
  const session = new KeyIdSession({
    settings: { timeoutSeconds: 10 },
    generator: {
      next: () => questions[n++ % Math.max(1, questions.length)] ?? question(`q${++n}`),
    },
    presenter,
    clock,
    getReadyMs: { first: 0, between: 0 },
    feedbackMs: 100,
    revealMs: 200,
    totalReps: 3,
    ...over,
  })
  const snaps: KeyIdSnapshot[] = []
  session.subscribe((s) => snaps.push(s))
  return { clock, presenter, session, snaps }
}

describe('answering by tap or typing', () => {
  it('a right answer finishes the rep as correct, with the time it took', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(3) // painted: t0 = 3
    await r.clock.advance(1200)
    r.session.answer({ accidentals: -3, mode: 'major' })
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct')
    expect(rep.mode).toBe('keyid')
    expect(rep.reactionMs).toBe(1200)
    expect(rep.completionMs).toBe(1200)
    expect(r.session.snapshot.state).toBe('INTERSTITIAL')
    expect(r.session.snapshot.lastOutcome).toBe('correct')
  })

  it('a wrong guess does not end the question or reveal the answer: you keep guessing', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(503)
    r.session.answer({ accidentals: 2, mode: 'major' })
    expect(r.session.results).toHaveLength(0)
    expect(r.session.snapshot.state).toBe('FLASHED')
    expect(r.session.snapshot.wrong).toEqual([{ accidentals: 2, mode: 'major' }])
    expect(r.session.snapshot.given).toBeNull()
    expect(r.presenter.log).not.toContain('reveal a')
    r.session.answer({ accidentals: 1, mode: 'major' })
    expect(r.session.snapshot.wrong).toHaveLength(2)
    expect(r.session.results).toHaveLength(0)
  })

  it('getting it right after wrong guesses finishes as correct with errors, and records every try', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(503) // t0 = 3, so this is 500 ms in
    r.session.answer({ accidentals: 2, mode: 'major' })
    await r.clock.advance(700)
    r.session.answer({ accidentals: 1, mode: 'major' })
    await r.clock.advance(800)
    r.session.answer({ accidentals: -3, mode: 'major' })
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct_with_errors')
    expect(rep.reactionMs).toBe(500) // the first guess
    expect(rep.completionMs).toBe(2000) // the right one
    expect(rep.errors).toEqual([
      { t: 500, notes: [] },
      { t: 1200, notes: [] },
    ])
    expect(rep.keyId).toEqual({
      format: 'major',
      correct: { accidentals: -3, mode: 'major' },
      given: { accidentals: -3, mode: 'major' },
      wrong: [
        { accidentals: 2, mode: 'major' },
        { accidentals: 1, mode: 'major' },
      ],
      wrongPlayed: [],
      method: 'tap',
    })
    expect(r.presenter.log).not.toContain('reveal a') // solved: nothing to reveal
    expect(r.session.snapshot.given).toEqual({ accidentals: -3, mode: 'major' })
  })

  it('keeps the question number while the result shows, and counts the next one when it begins', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(3)
    expect(r.session.snapshot.repNumber).toBe(1)
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.snapshot.repNumber).toBe(1) // not 2 the moment it was answered
    await r.clock.advance(100) // the feedback pause is over
    expect(r.session.snapshot.repNumber).toBe(2)
  })

  it('right on the first try is plain correct', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(1203)
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.results[0]).toMatchObject({
      outcome: 'correct',
      errors: [],
      reactionMs: 1200,
      completionMs: 1200,
    })
  })

  it('naming the same wrong key again is not a new mistake', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(3)
    r.session.answer({ accidentals: 2, mode: 'major' })
    r.session.answer({ accidentals: 2, mode: 'major' })
    expect(r.session.snapshot.wrong).toHaveLength(1)
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.results[0].errors).toHaveLength(1)
  })

  it('only the first right answer counts: another one during the feedback is ignored', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(3)
    r.session.answer({ accidentals: -3, mode: 'major' })
    r.session.answer({ accidentals: 1, mode: 'major' })
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.results).toHaveLength(1)
    expect(r.session.results[0].outcome).toBe('correct')
  })

  it('answers before the question appears are ignored', async () => {
    const r = rig({ getReadyMs: { first: 1000, between: 1000 } }, [question('a')])
    await r.session.start()
    r.session.answer({ accidentals: -3, mode: 'major' }) // still getting ready
    expect(r.session.results).toHaveLength(0)
    await r.clock.advance(1003)
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.results).toHaveLength(1)
  })

  it('times out after wrong guesses: the guesses are kept, and now the answer is revealed', async () => {
    const r = rig({ totalReps: 1 }, [question('a')])
    await r.session.start()
    await r.clock.advance(503)
    r.session.answer({ accidentals: 2, mode: 'major' })
    await r.clock.advance(10_010)
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('timeout')
    expect(rep.completionMs).toBeNull()
    expect(rep.reactionMs).toBe(500)
    expect(rep.keyId?.wrong).toEqual([{ accidentals: 2, mode: 'major' }])
    expect(rep.errors).toHaveLength(1)
    expect(r.presenter.log).toContain('reveal a')
  })

  it('times out, and skipping works; neither records an answer', async () => {
    const r = rig({ totalReps: 2 }, [question('a'), question('b')])
    await r.session.start()
    await r.clock.advance(10_010)
    expect(r.session.results[0].outcome).toBe('timeout')
    expect(r.session.results[0].keyId?.given).toBeNull()
    expect(r.session.results[0].reactionMs).toBeNull()
    await r.clock.advance(210)
    await r.clock.advance(10)
    r.session.skip()
    expect(r.session.results[1].outcome).toBe('skipped')
    expect(r.presenter.log).toContain('reveal b')
  })

  it('F♯ major and G♭ major are different answers, even though they sound the same', async () => {
    const r = rig({}, [question('a', 'major', 6)])
    await r.session.start()
    await r.clock.advance(3)
    r.session.answer({ accidentals: -6, mode: 'major' }) // G♭ for F♯: a wrong guess
    expect(r.session.snapshot.state).toBe('FLASHED')
    expect(r.session.snapshot.wrong).toEqual([{ accidentals: -6, mode: 'major' }])
    r.session.answer({ accidentals: 6, mode: 'major' })
    expect(r.session.results[0].outcome).toBe('correct_with_errors')
  })
})

describe('the shared rep cycle', () => {
  it('uses the same get-ready times as play mode: 4 seconds first, then 1 second', async () => {
    const r = rig({ getReadyMs: undefined, totalReps: 3 }, [question('a')])
    await r.session.start()
    expect(r.session.snapshot.ready).toEqual({ since: 0, at: 4000, first: true })
    await r.clock.advance(3990)
    expect(r.session.snapshot.state).toBe('READY')
    await r.clock.advance(20)
    expect(r.session.snapshot.state).toBe('FLASHED')
    r.session.answer({ accidentals: -3, mode: 'major' })
    await r.clock.advance(100)
    expect(r.session.snapshot.ready?.first).toBe(false)
  })

  it('does not wait for any input to go quiet when answers are tapped', async () => {
    const r = rig({ getReadyMs: undefined }, [question('a')])
    await r.session.start()
    await r.clock.advance(4003)
    expect(r.session.snapshot.state).toBe('FLASHED') // no input, no gate
  })

  it('empties the staff while getting ready, hides it on pause, and a paused rep is not recorded', async () => {
    const r = rig({}, [question('a')])
    await r.session.start()
    await r.clock.advance(3)
    r.session.pause()
    expect(r.session.results).toHaveLength(0)
    expect(r.presenter.log.at(-1)).toBe('clear')
    r.session.resume()
    await r.clock.advance(3)
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('runs a whole session and ends, with one result per question', async () => {
    const r = rig({ totalReps: 3 })
    await r.session.start()
    for (let i = 0; i < 3; i++) {
      await r.clock.advance(3)
      r.session.answer(r.session.snapshot.question!.answer)
      await r.clock.advance(100)
    }
    await r.clock.advance(50)
    expect(r.session.snapshot.state).toBe('ENDED')
    expect(r.session.results.map((x) => x.outcome)).toEqual(['correct', 'correct', 'correct'])
  })

  it('describes each rep by what was asked', async () => {
    const r = rig({}, [question('a', 'key', 0, 'minor')])
    await r.session.start()
    await r.clock.advance(3)
    r.session.answer({ accidentals: 0, mode: 'minor' })
    expect(r.session.results[0].dims).toEqual({
      key: 'A minor',
      clef: 'treble',
      format: 'key',
      keyMode: 'minor',
    })
  })

  it('works with a generator of real questions', async () => {
    const generator = new KeyIdGenerator({ ...DEFAULT_KEY_ID_CONFIG, maxAccidentals: 3 }, 4)
    const r = rig({ generator, totalReps: 4 })
    await r.session.start()
    for (let i = 0; i < 4; i++) {
      await r.clock.advance(3)
      r.session.answer(r.session.snapshot.question!.answer)
      await r.clock.advance(300)
    }
    expect(r.session.results.every((x) => x.outcome === 'correct')).toBe(true)
  })
})

describe("answering by playing the key's scale", () => {
  // E♭ major on the treble clef: Eb4 F4 G4 Ab4 Bb4 C5 D5 Eb5, then back down to Eb4 (16 notes)
  const playRig = (
    q = question('a', 'major'),
    settings = { timeoutSeconds: 10 as number | null },
  ) => {
    const clock = new FakeClock()
    const input = new ScriptedInput()
    const presenter = fakePresenter(clock)
    const session = new KeyIdSession({
      settings,
      method: 'play',
      generator: { next: () => q },
      presenter,
      input,
      clock,
      getReadyMs: { first: 0, between: 0 },
      silenceMs: 0,
      totalReps: 2,
    })
    return { clock, input, presenter, session, notes: scaleNotes(q) }
  }
  const tap = (r: ReturnType<typeof playRig>, midi: number) => {
    r.input.noteOn(midi, r.clock.now())
    r.input.noteOff(midi, r.clock.now())
  }

  it('the whole scale, up and back down in order, answers correctly with the time of the last note', async () => {
    const r = playRig()
    expect(r.notes).toHaveLength(16)
    await r.session.start()
    await r.clock.advance(503) // t0 = 3
    for (const [i, m] of r.notes.entries()) {
      expect(r.session.snapshot.progress).toBe(i)
      tap(r, m)
      await r.clock.advance(100)
    }
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct')
    expect(rep.reactionMs).toBe(500)
    expect(rep.completionMs).toBe(500 + 15 * 100)
    expect(rep.keyId).toMatchObject({ method: 'play', given: null, wrongPlayed: [] })
  })

  it('the snapshot carries the scale and how far along the player is', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    expect(r.session.snapshot.scale).toEqual(r.notes)
    tap(r, r.notes[0])
    tap(r, r.notes[1])
    expect(r.session.snapshot.progress).toBe(2)
  })

  it('a wrong note sends you back to the start, and the question carries on', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    tap(r, r.notes[0])
    tap(r, r.notes[1])
    tap(r, r.notes[2])
    tap(r, parsePitch('A4').midi) // not Ab4: wrong
    expect(r.session.results).toHaveLength(0)
    expect(r.session.snapshot.progress).toBe(0)
    expect(r.session.snapshot.wrongPlayed).toEqual([parsePitch('A4').midi])
    for (const m of r.notes) tap(r, m) // all over again
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct_with_errors')
    expect(rep.errors.map((e) => e.notes)).toEqual([[parsePitch('A4').midi]])
  })

  it('a wrong note near the end costs the whole run: 15 right notes, one wrong, start over', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    for (const m of r.notes.slice(0, 15)) tap(r, m)
    expect(r.session.snapshot.progress).toBe(15)
    tap(r, parsePitch('D4').midi) // the last note should be Eb4
    expect(r.session.snapshot.progress).toBe(0)
    expect(r.session.results).toHaveLength(0)
  })

  it('striking the same note twice, or the wrong octave, is a wrong note', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    tap(r, r.notes[0])
    tap(r, r.notes[0]) // a second strike of the tonic
    expect(r.session.snapshot.progress).toBe(1) // wrong, but it is the tonic, so it counts as a fresh start
    expect(r.session.snapshot.wrongPlayed).toHaveLength(1)
    tap(r, r.notes[1] + 12) // the right note a whole octave up
    expect(r.session.snapshot.progress).toBe(0)
    expect(r.session.snapshot.wrongPlayed).toHaveLength(2)
  })

  it('the top note has to be struck twice: going straight down from one strike is a wrong note', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    for (const m of r.notes.slice(0, 8)) tap(r, m) // up to the top note
    expect(r.session.snapshot.progress).toBe(8)
    tap(r, r.notes[9]) // the note below the top, skipping the second strike of the top
    expect(r.session.snapshot.progress).toBe(0)
    expect(r.session.snapshot.wrongPlayed).toHaveLength(1)
  })

  it('a note before the scale starts that is not the tonic is a wrong note too', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    tap(r, parsePitch('G4').midi)
    expect(r.session.snapshot.wrongPlayed).toEqual([parsePitch('G4').midi])
    expect(r.session.snapshot.progress).toBe(0)
  })

  it('a bass question wants the scale below middle C', async () => {
    const bass = { ...question('b', 'major', 0), clef: 'bass' as const } // C major
    const r = playRig(bass)
    expect(r.notes[0]).toBe(parsePitch('C3').midi)
    await r.session.start()
    await r.clock.advance(3)
    for (const m of r.notes) tap(r, m)
    expect(r.session.results[0].outcome).toBe('correct')
  })

  it('a minor key is played as natural minor', async () => {
    const r = playRig(question('m', 'minor', -3, 'minor')) // C minor
    expect(r.notes.slice(0, 4)).toEqual(['C4', 'D4', 'Eb4', 'F4'].map((n) => parsePitch(n).midi))
  })

  it('the time limit is 8 seconds longer when answering by playing, and shown in the snapshot', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    expect(r.session.snapshot.limitSeconds).toBe(18)
    await r.clock.advance(17000)
    expect(r.session.results).toHaveLength(0)
    await r.clock.advance(1100)
    expect(r.session.results[0].outcome).toBe('timeout')
  })

  it('tapping keeps the plain time limit, and no limit stays no limit', async () => {
    const tapRig = rig({}, [question('a')])
    await tapRig.session.start()
    await tapRig.clock.advance(3)
    expect(tapRig.session.snapshot.limitSeconds).toBe(10)
    const none = playRig(question('a'), { timeoutSeconds: null })
    await none.session.start()
    await none.clock.advance(3)
    expect(none.session.snapshot.limitSeconds).toBeNull()
  })

  it('a note that was ringing before the question appeared does not count', async () => {
    const r = playRig()
    r.input.noteOn(r.notes[0], -100) // ignored while stopped; the session has not started
    await r.session.start()
    await r.clock.advance(3)
    expect(r.session.snapshot.progress).toBe(0)
  })

  it('waits for the room to go quiet before flashing (the input is a live one)', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    for (const m of r.notes.slice(0, 15)) tap(r, m)
    r.input.noteOn(r.notes[15], r.clock.now()) // the last note, and the key is held down
    expect(r.session.results[0].outcome).toBe('correct')
    await r.clock.advance(3000) // feedback is over, but the note is still held
    expect(r.session.snapshot.state).toBe('READY') // not flashed while notes sound
    r.input.noteOff(r.notes[15], r.clock.now())
    await r.clock.advance(20)
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('tapped answers are ignored in play mode', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.results).toHaveLength(0)
  })

  it('needs an input', () => {
    expect(
      () =>
        new KeyIdSession({
          settings: { timeoutSeconds: 10 },
          method: 'play',
          generator: { next: () => question('a') },
          presenter: fakePresenter(new FakeClock()),
        }),
    ).toThrow(RangeError)
  })

  it('can switch between tapping and playing at any time', async () => {
    const r = playRig()
    await r.session.start()
    await r.clock.advance(3)
    r.session.setMethod('tap')
    tap(r, r.notes[0]) // played notes are ignored while tapping
    expect(r.session.snapshot.progress).toBe(0)
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.results[0]).toMatchObject({ outcome: 'correct' })
    expect(r.session.results[0].keyId?.method).toBe('tap')
    await r.clock.advance(1500)
    r.session.setMethod('play')
    expect(r.session.snapshot.method).toBe('play')
  })
})
