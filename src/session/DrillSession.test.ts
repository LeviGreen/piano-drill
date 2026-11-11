import { beforeEach, describe, expect, it } from 'vitest'
import { ScriptedInput } from '../audio/inputs/ScriptedInput'
import { parseSettings, type DifficultySettings } from '../levels/settings'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import type { Target } from '../theory/target'
import { FakeClock } from '../test-utils/fakeClock'
import { DrillSession, type SessionOptions, type SessionSnapshot } from './DrillSession'
import type { Presenter } from './types'

const settings = (over: Record<string, unknown> = {}): DifficultySettings => {
  const r = parseSettings({ hands: ['RH'], timeoutSeconds: 10, ...over })
  if (!r.ok) throw new Error(r.errors.join(', '))
  return r.settings
}

/** A target: C major triad in the right hand unless told otherwise. */
const target = (id: string, notes = ['C4', 'E4', 'G4']): Target => ({
  id,
  key: keySignature(0, 'major'),
  parts: [{ hand: 'RH', clef: 'treble', pitches: notes.map(parsePitch) }],
  content: { type: 'triad' },
})

function fakePresenter(clock: FakeClock, paintDelay = 3) {
  const log: string[] = []
  const p: Presenter & { log: string[] } = {
    log,
    prepare: (t) => void log.push(`prepare ${t.id}`),
    flash: (t) =>
      new Promise((resolve) => {
        log.push(`flash ${t.id}`)
        clock.setTimeout(() => resolve(clock.now()), paintDelay) // painted a few ms after the swap
      }),
    reveal: (t) => void log.push(`reveal ${t.id}`),
    clear: () => void log.push('clear'),
  }
  return p
}

type Rig = {
  clock: FakeClock
  input: ScriptedInput
  presenter: ReturnType<typeof fakePresenter>
  session: DrillSession
  snaps: SessionSnapshot[]
  /** Tap notes at the current fake time: struck and released at once (an onset, then silence). */
  play: (...names: string[]) => void
  /** Run until the target is on screen (painted 3 ms after the swap, so t0 = 3 for the first rep). */
  untilFlashed: () => Promise<void>
}

function rig(over: Partial<SessionOptions> = {}, targets?: Target[]): Rig {
  const clock = new FakeClock()
  const input = new ScriptedInput()
  const presenter = fakePresenter(clock)
  let n = 0
  const generator = { next: () => targets?.[n++ % targets.length] ?? target(`t${++n}`) }
  const session = new DrillSession({
    settings: settings(),
    generator,
    input,
    presenter,
    clock,
    getReadyMs: { first: 0, between: 0 },
    silenceMs: 0,
    feedbackMs: 100,
    revealMs: 200,
    totalReps: 3,
    ...over,
  })
  const snaps: SessionSnapshot[] = []
  session.subscribe((s) => snaps.push(s))
  return {
    clock,
    input,
    presenter,
    session,
    snaps,
    play: (...names) => {
      for (const m of names) input.noteOn(parsePitch(m).midi, clock.now())
      for (const m of names) input.noteOff(parsePitch(m).midi, clock.now())
    },
    untilFlashed: async () => {
      await clock.advance(3)
    },
  }
}

const states = (r: Rig) => r.snaps.map((s) => s.state)

describe('a successful rep', () => {
  let r: Rig
  beforeEach(async () => {
    r = rig()
    await r.session.start()
    await r.untilFlashed()
  })

  it('goes IDLE, READY, FLASHED and flashes the prepared target', () => {
    expect(states(r)).toEqual(['READY', 'FLASHED'])
    expect(r.session.snapshot.state).toBe('FLASHED')
    expect(r.presenter.log.filter((l) => l !== 'clear').slice(0, 2)).toEqual([
      'prepare t1',
      'flash t1',
    ])
    expect(r.session.snapshot.expected).toEqual([60, 64, 67])
  })

  it('takes t0 from when the target was painted, not from when it was swapped in', () => {
    expect(r.session.snapshot.t0).toBe(3) // flashed at 0, painted 3 ms later
  })

  it('records reaction and completion times, in ms after t0, when notes are played one after another', async () => {
    await r.clock.advance(497) // time 500
    r.play('E4')
    await r.clock.advance(300)
    r.play('C4')
    await r.clock.advance(200)
    r.play('G4')
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct')
    expect(rep.reactionMs).toBe(497) // E4 at 500, t0 = 3
    expect(rep.completionMs).toBe(997) // G4 at 1000
    expect(rep.heard.map((h) => h.midi)).toEqual([64, 60, 67])
    expect(rep.errors).toEqual([])
  })

  it('succeeds when the notes are struck together, with completion equal to reaction', async () => {
    await r.clock.advance(100)
    r.play('C4', 'E4', 'G4')
    const rep = r.session.results[0]
    expect(rep.reactionMs).toBe(100)
    expect(rep.completionMs).toBe(100)
    // SUCCESS, then the feedback pause (INTERSTITIAL).
    expect(states(r).slice(-2)).toEqual(['SUCCESS', 'INTERSTITIAL'])
  })

  it('empties the staff while getting ready, before each target is flashed', async () => {
    expect(r.presenter.log.indexOf('clear')).toBeLessThan(r.presenter.log.indexOf('flash t1'))
    r.play('C4', 'E4', 'G4')
    await r.clock.advance(100) // feedback over: the next get-ready begins
    const log = r.presenter.log
    const lastClear = log.lastIndexOf('clear')
    expect(lastClear).toBeGreaterThan(log.indexOf('flash t1')) // cleared again after the first target...
    await r.clock.advance(3)
    expect(log.indexOf('flash t2')).toBeGreaterThan(lastClear) // ...and before the second is flashed
  })

  it('moves to the next rep after the feedback pause, with the next target', async () => {
    r.play('C4', 'E4', 'G4')
    expect(r.session.snapshot.state).toBe('INTERSTITIAL')
    await r.clock.advance(100) // feedback over: the next rep is ready and flashes at once
    await r.clock.advance(3) // ...and is painted
    expect(r.session.snapshot.state).toBe('FLASHED')
    expect(r.session.snapshot.repNumber).toBe(2)
    expect(r.presenter.log).toContain('flash t2')
  })

  it('keeps notes heard once they are heard: a repeated note changes nothing', async () => {
    r.play('C4')
    await r.clock.advance(50)
    r.play('C4')
    expect(r.session.snapshot.heard).toEqual([60])
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('ignores a note that was ringing before the flash', async () => {
    // Fresh rig: an onset stamped before t0 must not count.
    const q = rig()
    await q.session.start()
    q.input.noteOn(parsePitch('C4').midi, -50) // struck and released before the flash
    q.input.noteOff(parsePitch('C4').midi, -49)
    await q.untilFlashed()
    expect(q.session.snapshot.heard).toEqual([])
    expect(q.session.snapshot.errors).toEqual([])
  })
})

describe('wrong notes', () => {
  it('are logged with their time but never undo what was heard, and the rep still succeeds', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    await r.clock.advance(197)
    r.play('C4')
    await r.clock.advance(100)
    r.play('F#4') // wrong
    expect(r.session.snapshot.heard).toEqual([60]) // still heard
    expect(r.session.snapshot.errors).toEqual([{ t: 297, notes: [66] }])
    expect(r.session.snapshot.state).toBe('FLASHED')
    await r.clock.advance(100)
    r.play('E4', 'G4')
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('correct_with_errors')
    expect(rep.errors).toEqual([{ t: 297, notes: [66] }])
    expect(rep.completionMs).toBe(397)
  })

  it('every wrong onset is logged separately', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    r.play('D4')
    await r.clock.advance(10)
    r.play('A4')
    expect(r.session.snapshot.errors.map((e) => e.notes[0])).toEqual([62, 69])
  })
})

describe('timeout and skip', () => {
  it('times out after timeoutSeconds from t0, records what was heard, and reveals the answer', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    await r.clock.advance(100)
    r.play('C4')
    await r.clock.advance(9890) // 9990 ms after t0: still waiting
    expect(r.session.snapshot.state).toBe('FLASHED')
    await r.clock.advance(20)
    expect(r.session.snapshot.state).toBe('INTERSTITIAL')
    const rep = r.session.results[0]
    expect(rep.outcome).toBe('timeout')
    expect(rep.completionMs).toBeNull()
    expect(rep.reactionMs).toBe(100)
    expect(rep.heard).toHaveLength(1)
    expect(r.presenter.log).toContain('reveal t1')
    expect(states(r)).toContain('TIMEOUT')
  })

  it('never times out when timeoutSeconds is null', async () => {
    const r = rig({ settings: settings({ timeoutSeconds: null }) })
    await r.session.start()
    await r.untilFlashed()
    await r.clock.advance(10 * 60 * 1000)
    expect(r.session.snapshot.state).toBe('FLASHED')
    expect(r.session.results).toHaveLength(0)
  })

  it('skip ends the rep as skipped, reveals, and moves on', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    r.session.skip()
    expect(r.session.results[0].outcome).toBe('skipped')
    expect(r.session.results[0].reactionMs).toBeNull()
    expect(r.presenter.log).toContain('reveal t1')
    expect(states(r)).toContain('SKIPPED')
    await r.clock.advance(200)
    await r.clock.advance(3)
    expect(r.session.snapshot.repNumber).toBe(2)
  })

  it('skip does nothing when no target is on screen', async () => {
    const r = rig()
    await r.session.start()
    r.session.skip()
    expect(r.session.results).toHaveLength(0)
  })
})

describe('waiting for quiet before a flash (READY)', () => {
  it('holds the flash while notes are still sounding, then waits the silence period', async () => {
    const r = rig({ silenceMs: 300 })
    await r.session.start()
    r.input.noteOn(parsePitch('C4').midi, 0) // a note still ringing at the start
    await r.clock.advance(2000)
    expect(r.session.snapshot.state).toBe('READY') // not flashed while it rings
    r.input.noteOff(parsePitch('C4').midi, r.clock.now())
    await r.clock.advance(299)
    expect(r.session.snapshot.state).toBe('READY') // quiet, but not for long enough
    await r.clock.advance(10)
    expect(r.session.snapshot.state).toBe('FLASHED')
    expect(r.session.results).toHaveLength(0)
  })

  it('waits 4 seconds before the first target by default: not before, and the flash comes right at 4 s', async () => {
    const r = rig({ getReadyMs: undefined }) // the product default
    await r.session.start()
    await r.clock.advance(3990)
    expect(r.session.snapshot.state).toBe('READY')
    expect(r.presenter.log.filter((l) => l.startsWith('flash'))).toEqual([])
    await r.clock.advance(20)
    expect(r.presenter.log.filter((l) => l.startsWith('flash'))).toEqual(['flash t1'])
    await r.clock.advance(10)
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('says when the flash is due and whether it is the long first wait, so the screen can count down', async () => {
    const r = rig({ getReadyMs: undefined, totalReps: 3 })
    expect(r.session.snapshot.ready).toBeNull() // not before the session starts
    await r.session.start()
    expect(r.session.snapshot.ready).toEqual({ since: 0, at: 4000, first: true })
    await r.clock.advance(4003)
    expect(r.session.snapshot.ready).toBeNull() // not while a target is on screen
    r.play('C4', 'E4', 'G4')
    await r.clock.advance(100)
    expect(r.session.snapshot.ready).toEqual({ since: 4103, at: 4003 + 100 + 1000, first: false })
  })

  it('counts down again after a resume (it is a fresh start)', async () => {
    const r = rig({ getReadyMs: undefined })
    await r.session.start()
    await r.clock.advance(1000)
    r.session.pause()
    expect(r.session.snapshot.ready).toBeNull()
    r.session.resume()
    expect(r.session.snapshot.ready).toEqual({ since: 1000, at: 1000 + 4000, first: true })
  })

  it('then waits only 1 second between targets', async () => {
    const r = rig({ getReadyMs: undefined, totalReps: 3 })
    await r.session.start()
    await r.clock.advance(4003) // first target painted
    r.play('C4', 'E4', 'G4')
    await r.clock.advance(100) // the feedback pause ends; the 1-second get-ready begins
    expect(r.session.snapshot.state).toBe('READY')
    await r.clock.advance(990)
    expect(r.session.snapshot.state).toBe('READY')
    expect(r.presenter.log.filter((l) => l.startsWith('flash'))).toHaveLength(1)
    await r.clock.advance(20)
    expect(r.presenter.log.filter((l) => l.startsWith('flash'))).toHaveLength(2)
    await r.clock.advance(5)
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('a resume after a pause is a fresh start, so the 4-second wait applies again', async () => {
    const r = rig({ getReadyMs: undefined })
    await r.session.start()
    await r.clock.advance(4003)
    r.session.pause()
    r.session.resume()
    await r.clock.advance(3990)
    expect(r.session.snapshot.state).toBe('READY')
    await r.clock.advance(20)
    await r.clock.advance(5)
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('flashes anyway after maxWaitMs in a noisy room, and marks the rep', async () => {
    const r = rig({ maxWaitMs: 1000, getReadyMs: { first: 500, between: 500 } }) // READY for 500 ms, so a note can start ringing first
    await r.session.start()
    r.input.noteOn(parsePitch('C4').midi, 0) // never released: the room is never quiet
    await r.clock.advance(1100)
    expect(r.session.snapshot.state).toBe('FLASHED') // flashed anyway after 1000 ms
    r.input.noteOn(parsePitch('E4').midi, r.clock.now())
    r.input.noteOn(parsePitch('G4').midi, r.clock.now())
    r.input.noteOn(parsePitch('C4').midi, r.clock.now()) // struck again after the flash
    expect(r.session.results[0].outcome).toBe('correct')
    expect(r.session.results[0].startedWithoutSilence).toBe(true)
  })

  it('a normal start is not marked noisy', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    r.play('C4', 'E4', 'G4')
    expect(r.session.results[0].startedWithoutSilence).toBe(false)
  })
})

describe('pause, resume and end', () => {
  it('pausing a rep that is on screen voids it: no result, the target is hidden, resume starts a fresh rep', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    r.play('C4')
    r.session.pause()
    expect(r.session.snapshot.state).toBe('PAUSED')
    expect(r.presenter.log.at(-1)).toBe('clear')
    await r.clock.advance(60_000) // no timeout while paused
    expect(r.session.results).toHaveLength(0)
    r.session.resume()
    await r.clock.advance(20)
    expect(r.session.snapshot.state).toBe('FLASHED')
    expect(r.session.snapshot.repNumber).toBe(1) // the voided rep is not counted
    expect(r.session.snapshot.heard).toEqual([]) // starts clean
  })

  it('pausing during the feedback keeps the finished rep and resumes with the next one', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    r.play('C4', 'E4', 'G4')
    r.session.pause()
    expect(r.session.results).toHaveLength(1)
    r.session.resume()
    await r.clock.advance(20)
    expect(r.session.snapshot.repNumber).toBe(2)
    expect(r.session.snapshot.state).toBe('FLASHED')
  })

  it('pausing while waiting for quiet just stops the wait', async () => {
    const r = rig({ getReadyMs: { first: 1000, between: 1000 } })
    await r.session.start()
    r.session.pause()
    await r.clock.advance(5000)
    expect(r.session.snapshot.state).toBe('PAUSED')
    expect(r.presenter.log.filter((l) => l.startsWith('flash'))).toEqual([])
  })

  it('a flash that finishes painting after a pause is ignored', async () => {
    const r = rig()
    await r.session.start()
    await r.clock.advance(1) // flash requested, still painting
    r.session.pause()
    await r.clock.advance(50)
    expect(r.session.snapshot.state).toBe('PAUSED')
    expect(r.session.snapshot.t0).toBeNull()
  })

  it('end stops the input, clears the screen and records nothing for a rep in progress', async () => {
    const r = rig()
    await r.session.start()
    await r.untilFlashed()
    r.session.end()
    expect(r.session.snapshot.state).toBe('ENDED')
    expect(r.session.results).toHaveLength(0)
    expect(r.presenter.log.at(-1)).toBe('clear')
    r.play('C4', 'E4', 'G4') // input is stopped: nothing happens
    await r.clock.advance(5000)
    expect(r.session.results).toHaveLength(0)
  })

  it('pause and resume are harmless in other states', async () => {
    const r = rig()
    r.session.pause()
    r.session.resume()
    expect(r.session.snapshot.state).toBe('IDLE')
    await r.session.start()
    r.session.resume() // not paused
    expect(r.session.snapshot.state).toBe('READY')
  })
})

describe('a whole session', () => {
  it('runs the requested number of reps, then ends, with one result each in order', async () => {
    const r = rig({ totalReps: 3 })
    await r.session.start()
    for (let i = 0; i < 3; i++) {
      await r.untilFlashed()
      r.play('C4', 'E4', 'G4')
      await r.clock.advance(100) // feedback; the next rep flashes at once
    }
    await r.clock.advance(50)
    expect(r.session.snapshot.state).toBe('ENDED')
    expect(r.session.results.map((x) => x.outcome)).toEqual(['correct', 'correct', 'correct'])
    expect(new Set(r.session.results.map((x) => x.targetId)).size).toBe(3)
    expect(r.session.results.every((x) => x.sessionId === r.session.results[0].sessionId)).toBe(
      true,
    )
  })

  it('does not prepare a target beyond the last rep', async () => {
    const r = rig({ totalReps: 1 })
    await r.session.start()
    await r.untilFlashed()
    expect(r.presenter.log.filter((l) => l.startsWith('prepare'))).toHaveLength(1)
  })

  it('mixes outcomes and keeps them straight', async () => {
    const r = rig({ totalReps: 3 })
    await r.session.start()
    await r.untilFlashed()
    r.play('C4', 'E4', 'G4') // correct
    await r.clock.advance(120) // feedback over, rep 2 painted
    r.session.skip() // skipped
    await r.clock.advance(220)
    await r.clock.advance(11_000) // timeout
    expect(r.session.results.map((x) => x.outcome)).toEqual(['correct', 'skipped', 'timeout'])
    expect(r.session.snapshot.completedReps).toBe(3)
  })

  it('describes each rep: hands, clef, key, note count and content type', async () => {
    const r = rig({}, [target('x', ['C4', 'E4'])])
    await r.session.start()
    await r.untilFlashed()
    r.play('C4', 'E4')
    expect(r.session.results[0].dims).toEqual({
      hands: 'RH',
      clef: 'treble',
      key: 'C major',
      noteCount: 2,
      contentType: 'triad',
    })
    expect(r.session.results[0].mode).toBe('play')
  })

  it('works for two-hand targets: both clefs, all notes from both hands', async () => {
    const two: Target = {
      id: 'two',
      key: keySignature(0, 'major'),
      parts: [
        { hand: 'LH', clef: 'bass', pitches: [parsePitch('C3')] },
        { hand: 'RH', clef: 'treble', pitches: ['E4', 'G4'].map(parsePitch) },
      ],
      content: { type: 'triad' },
    }
    const r = rig({}, [two])
    await r.session.start()
    await r.untilFlashed()
    expect(r.session.snapshot.expected).toEqual([48, 64, 67])
    r.play('E4', 'G4')
    expect(r.session.snapshot.state).toBe('FLASHED') // the left-hand note is still missing
    r.play('C3')
    expect(r.session.results[0].dims).toMatchObject({ hands: 'both', clef: 'both', noteCount: 3 })
  })

  it('octave strictness: "exact" needs the right octave, "any" accepts another octave', async () => {
    const exact = rig({ settings: settings({ octaveStrictness: 'exact' }) }, [target('a', ['C4'])])
    await exact.session.start()
    await exact.untilFlashed()
    exact.play('C5')
    expect(exact.session.snapshot.heard).toEqual([])
    expect(exact.session.snapshot.errors).toHaveLength(1)

    const any = rig({ settings: settings({ octaveStrictness: 'any' }) }, [target('a', ['C4'])])
    await any.session.start()
    await any.untilFlashed()
    any.play('C5')
    expect(any.session.results[0].outcome).toBe('correct')
  })

  it('reports a presenter failure instead of hanging', async () => {
    const r = rig()
    r.presenter.flash = () => Promise.reject(new Error('screen broke'))
    await r.session.start()
    await r.clock.advance(20)
    expect(r.session.snapshot.state).toBe('ENDED')
    expect(r.session.snapshot.failure).toBe('screen broke')
  })

  it('is deterministic: the same seed and inputs give the same results', async () => {
    const run = async () => {
      const r = rig({ getReadyMs: { first: 900, between: 400 } })
      await r.session.start()
      await r.clock.advance(1000)
      r.play('C4', 'E4', 'G4')
      return r.session.results[0].completionMs
    }
    expect(await run()).toBe(await run())
  })
})
