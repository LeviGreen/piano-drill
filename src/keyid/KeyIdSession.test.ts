import { describe, expect, it } from 'vitest'
import { ScriptedInput } from '../audio/inputs/ScriptedInput'
import type { Presenter } from '../session/types'
import { FakeClock } from '../test-utils/fakeClock'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
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

describe('answering by playing the checklist', () => {
  // E♭ major on the treble clef (3 flats): everything is played at or above middle C.
  const UP = ['Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5', 'D5', 'Eb5'].map((n) => parsePitch(n).midi)
  const DOWN = [...UP].reverse()
  const ROOT = ['Eb4', 'G4', 'Bb4'].map((n) => parsePitch(n).midi)
  const FIRST = ['G4', 'Bb4', 'Eb5'].map((n) => parsePitch(n).midi)
  const SECOND = ['Bb4', 'Eb5', 'G5'].map((n) => parsePitch(n).midi)
  const FLATS = ['Bb4', 'Eb4', 'Ab4'].map((n) => parsePitch(n).midi)

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
    return { clock, input, presenter, session }
  }
  type Rig = ReturnType<typeof playRig>
  const tap = async (r: Rig, midi: number) => {
    r.input.noteOn(midi, r.clock.now())
    r.input.noteOff(midi, r.clock.now())
    await r.clock.advance(50)
  }
  const run = async (r: Rig, notes: number[]) => {
    for (const m of notes) await tap(r, m)
  }
  /** Strike notes one after another and hold them all, then let go: a chord. */
  const chord = async (r: Rig, notes: number[]) => {
    for (const m of notes) r.input.noteOn(m, r.clock.now())
    await r.clock.advance(50)
    for (const m of notes) r.input.noteOff(m, r.clock.now())
    await r.clock.advance(50)
  }
  const rows = (r: Rig) => Object.fromEntries(r.session.snapshot.checklist.map((x) => [x.id, x]))
  const begin = async (r: Rig) => {
    await r.session.start()
    await r.clock.advance(3)
  }

  it('lists what to play without saying which key it is', async () => {
    const r = playRig()
    await begin(r)
    expect(r.session.snapshot.checklist.map((x) => x.label)).toEqual([
      'Scale up',
      'Scale down',
      'Tonic chord',
      'First inversion',
      'Second inversion',
      'Flats in order',
    ])
    expect(r.session.snapshot.checklist.every((x) => !x.done)).toBe(true)
  })

  it('a key with no sharps or flats still lists the row, already ticked', async () => {
    const r = playRig(question('c', 'major', 0))
    await begin(r)
    expect(rows(r).accidentals.done).toBe(true)
    expect(rows(r).accidentals.label).toBe('Sharps or flats in order')
    expect(r.session.snapshot.checklist).toHaveLength(6)
  })

  it('finishing every row, in any order, answers correctly, with the time of the last one', async () => {
    const r = playRig()
    await begin(r)
    await chord(r, SECOND)
    await run(r, DOWN) // going down first
    await run(r, FLATS)
    await chord(r, ROOT)
    await run(r, UP)
    expect(rows(r).up.done && rows(r).down.done && rows(r).root.done).toBe(true)
    expect(r.session.results).toHaveLength(0) // the first inversion is still to do
    const t = r.clock.now()
    await chord(r, FIRST)
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct')
    expect(rep.completionMs).toBeLessThanOrEqual(r.clock.now() - t + (t - 3))
    expect(rep.errors).toEqual([])
    expect(rep.keyId).toMatchObject({ method: 'play', given: null, wrongPlayed: [] })
  })

  it('the top note can be struck once or twice between going up and coming down', async () => {
    const once = playRig()
    await begin(once)
    await run(once, [...UP, ...DOWN.slice(1)])
    expect(rows(once).up.done && rows(once).down.done).toBe(true)
    const twice = playRig()
    await begin(twice)
    await run(twice, [...UP, ...DOWN])
    expect(rows(twice).up.done && rows(twice).down.done).toBe(true)
  })

  it('a slip in the scale resets only that row, and costs nothing if the note is in the key', async () => {
    const r = playRig()
    await begin(r)
    await chord(r, ROOT)
    await run(r, UP.slice(0, 4))
    expect(rows(r).up.progress).toBe(4)
    await tap(r, parsePitch('D5').midi) // in the key, but not the next note
    expect(rows(r).up.progress).toBe(0)
    expect(rows(r).root.done).toBe(true) // kept
    expect(r.session.snapshot.wrongPlayed).toEqual([])
    await run(r, UP)
    expect(rows(r).up.done).toBe(true)
  })

  it('a note that is not in the key costs a wrong note and resets only the row in progress', async () => {
    const r = playRig()
    await begin(r)
    await run(r, UP.slice(0, 3))
    await tap(r, parsePitch('E4').midi) // E natural is not in E♭ major
    expect(r.session.snapshot.wrongPlayed).toEqual([parsePitch('E4').midi])
    expect(rows(r).up.progress).toBe(0)
    await run(r, UP)
    await run(r, DOWN)
    await chord(r, ROOT)
    await chord(r, FIRST)
    await chord(r, SECOND)
    await run(r, FLATS)
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct_with_errors')
    expect(rep.errors.map((e) => e.notes)).toEqual([[parsePitch('E4').midi]])
  })

  it('notes on the other side of middle C are ignored: they reset nothing and cost nothing', async () => {
    const r = playRig()
    await begin(r)
    await run(r, UP.slice(0, 4))
    await tap(r, parsePitch('C3').midi) // the other hand (an in-key note below middle C)
    await tap(r, parsePitch('E3').midi) // and one that is out of key
    expect(rows(r).up.progress).toBe(4)
    expect(r.session.snapshot.wrongPlayed).toEqual([])
    r.input.noteOn(parsePitch('C2').midi, r.clock.now()) // held under the chord, too
    await chord(r, ROOT)
    expect(rows(r).root.done).toBe(true)
  })

  it('a chord is exactly its three notes held together, and the lowest note says which inversion', async () => {
    const r = playRig()
    await begin(r)
    await chord(r, [ROOT[0], parsePitch('Eb5').midi, ROOT[1], ROOT[2]]) // four notes, the root doubled: not the chord
    await chord(r, [ROOT[0], ROOT[1]]) // only two
    await chord(r, [parsePitch('Eb4').midi, parsePitch('Ab4').midi, parsePitch('C5').midi]) // some other chord
    expect(rows(r).root.done || rows(r).first.done || rows(r).second.done).toBe(false)
    await chord(r, FIRST)
    expect(rows(r).first.done).toBe(true)
    expect(rows(r).root.done).toBe(false)
    await chord(r, SECOND)
    expect(rows(r).second.done).toBe(true)
    // a chord can be rolled: struck one at a time, held until the third arrives
    for (const m of ROOT) {
      r.input.noteOn(m, r.clock.now())
      await r.clock.advance(60)
    }
    expect(rows(r).root.done).toBe(true)
  })

  it('the sharps or flats are played in the order they are written, in any octave, one after another', async () => {
    const r = playRig()
    await begin(r)
    await tap(r, parsePitch('Bb4').midi)
    await tap(r, parsePitch('Eb6').midi)
    expect(rows(r).accidentals.progress).toBe(2)
    await tap(r, parsePitch('F5').midi) // a note between them: back to the start
    expect(rows(r).accidentals.progress).toBe(0)
    await tap(r, parsePitch('Eb5').midi) // out of order
    expect(rows(r).accidentals.progress).toBe(0)
    await run(r, [parsePitch('Bb5').midi, parsePitch('Eb5').midi, parsePitch('Ab4').midi])
    expect(rows(r).accidentals.done).toBe(true)
  })

  it('a bass question is played below middle C, and the scale can climb past it', async () => {
    const bass = { ...question('b', 'major', 5), clef: 'bass' as const } // B major, 5 sharps
    const r = playRig(bass)
    await begin(r)
    const up = [59, 61, 63, 64, 66, 68, 70, 71] // B3 up to B4: the top notes are above middle C
    await run(r, up)
    expect(rows(r).up.done).toBe(true)
    await tap(r, 72) // a treble-side note that is not expected: ignored
    await run(r, [...up].reverse())
    expect(rows(r).down.done).toBe(true)
    expect(r.session.snapshot.wrongPlayed).toEqual([])
    await chord(r, [59, 63, 66]) // B3 D#4 F#4: root position, the lowest note below middle C
    expect(rows(r).root.done).toBe(true)
  })

  it('a smooth scale counts: the next key may go down before the last one is up', async () => {
    const r = playRig()
    await begin(r)
    for (const m of UP) {
      r.input.noteOn(m, r.clock.now())
      await r.clock.advance(30)
    }
    for (const m of UP) r.input.noteOff(m, r.clock.now())
    expect(rows(r).up.done).toBe(true)
    await r.clock.advance(50)
    // and back down, each key still held when the next one goes down
    for (const m of DOWN) {
      r.input.noteOn(m, r.clock.now())
      await r.clock.advance(30)
    }
    for (const m of DOWN) r.input.noteOff(m, r.clock.now())
    expect(rows(r).down.done).toBe(true)
    expect(r.session.snapshot.wrongPlayed).toEqual([])
  })

  it('in the bass, the inversions count when they climb above middle C from a root position below it', async () => {
    const g = { ...question('g', 'major', 1), clef: 'bass' as const } // G major
    const r = playRig(g)
    await begin(r)
    await chord(r, [55, 59, 62]) // G3 B3 D4
    await chord(r, [59, 62, 67]) // B3 D4 G4
    await chord(r, [62, 67, 71]) // D4 G4 B4: all at or above middle C
    expect(rows(r).root.done).toBe(true)
    expect(rows(r).first.done).toBe(true)
    expect(rows(r).second.done).toBe(true)
  })

  it('in the bass, a chord whose root position is above middle C does not count', async () => {
    const g = { ...question('g', 'major', 1), clef: 'bass' as const }
    const r = playRig(g)
    await begin(r)
    await chord(r, [67, 71, 74]) // G4 B4 D5
    expect(rows(r).root.done).toBe(false)
  })

  it('shows the keys being held, red if they are out of key', async () => {
    const r = playRig()
    await begin(r)
    r.input.noteOn(UP[0], r.clock.now())
    r.input.noteOn(parsePitch('E4').midi, r.clock.now())
    expect(r.session.snapshot.held).toEqual([
      { midi: UP[0], wrong: false },
      { midi: parsePitch('E4').midi, wrong: true },
    ])
    r.input.noteOff(UP[0], r.clock.now())
    r.input.noteOff(parsePitch('E4').midi, r.clock.now())
    expect(r.session.snapshot.held).toEqual([])
  })

  it('the time limit is 25 seconds longer when answering by playing, and shown in the snapshot', async () => {
    const r = playRig()
    await begin(r)
    expect(r.session.snapshot.limitSeconds).toBe(35)
    await r.clock.advance(34000)
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
    r.input.noteOn(UP[0], -100) // ignored while stopped; the session has not started
    await begin(r)
    expect(rows(r).up.progress).toBe(0)
  })

  it('waits for the room to go quiet before flashing (the input is a live one)', async () => {
    const r = playRig()
    await begin(r)
    await run(r, [...UP, ...DOWN.slice(1)])
    await chord(r, ROOT)
    await chord(r, FIRST)
    await run(r, FLATS)
    r.input.noteOn(SECOND[0], r.clock.now()) // the last row's notes: held down...
    r.input.noteOn(SECOND[1], r.clock.now())
    r.input.noteOn(SECOND[2], r.clock.now())
    expect(r.session.results[0].outcome).toBe('correct')
    await r.clock.advance(3000) // feedback is over, but the keys are still held
    expect(r.session.snapshot.state).toBe('READY') // not flashed while notes sound
    for (const m of SECOND) r.input.noteOff(m, r.clock.now())
    await r.clock.advance(20)
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('tapped answers are ignored in play mode', async () => {
    const r = playRig()
    await begin(r)
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
    await begin(r)
    r.session.setMethod('tap')
    await tap(r, UP[0]) // played notes are ignored while tapping
    expect(r.session.snapshot.checklist).toEqual([])
    r.session.answer({ accidentals: -3, mode: 'major' })
    expect(r.session.results[0]).toMatchObject({ outcome: 'correct' })
    expect(r.session.results[0].keyId?.method).toBe('tap')
    await r.clock.advance(1500)
    r.session.setMethod('play')
    expect(r.session.snapshot.method).toBe('play')
  })
})
