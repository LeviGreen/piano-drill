import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ScriptedInput } from '../audio/inputs/ScriptedInput'
import { createLevelGenerator } from '../levels/levelGenerator'
import { PRESET_LEVELS } from '../levels/presets'
import { FlashController } from '../notation/flash'
import { PianoKeyboard, type KeyMark } from '../notation/PianoKeyboard'
import { renderGrandStaff } from '../notation/renderGrandStaff'
import { DrillSession } from '../session/DrillSession'
import type { Presenter, RepResult, SessionSnapshot } from '../session/types'
import { keySignature } from '../theory/keys'
import { formatPitch } from '../theory/pitch'
import type { Target } from '../theory/target'

const REPS = 5

/** The empty grand staff (both clefs, no key signature, no notes) that sits there before and between targets. */
const drawEmptyStaff = (el: HTMLElement | null) => {
  if (el) renderGrandStaff(el, { key: keySignature(0, 'major') })
}

const OUTCOME_TEXT: Record<string, string> = {
  correct: 'correct',
  correct_with_errors: 'correct, with wrong notes',
  timeout: 'timed out',
  skipped: 'skipped',
}

/** Dev screen for PD-401: play a drill session by clicking the on-screen keyboard. (PD-402 builds the real drill screen.) */
export function SessionDemoScreen() {
  const stage = useRef<HTMLDivElement>(null)
  const session = useRef<DrillSession | null>(null)
  const input = useRef<ScriptedInput | null>(null)
  const [levelId, setLevelId] = useState(1)
  const [snap, setSnap] = useState<SessionSnapshot | null>(null)
  const [results, setResults] = useState<RepResult[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [now, setNow] = useState(() => performance.now())

  const stop = () => session.current?.end()

  useEffect(() => {
    drawEmptyStaff(stage.current)
    return () => session.current?.end()
  }, [])

  const start = async () => {
    session.current?.end()
    const level = PRESET_LEVELS.find((l) => l.id === levelId)!
    const scripted = new ScriptedInput()
    input.current = scripted
    const flash = new FlashController<Target>({
      container: stage.current!,
      render: (into, t) =>
        renderGrandStaff(into, {
          key: t.key,
          lh: t.parts.find((p) => p.hand === 'LH')?.pitches,
          rh: t.parts.find((p) => p.hand === 'RH')?.pitches,
        }),
    })
    const presenter: Presenter = {
      prepare: (t) => flash.prepare(t),
      flash: async (t) => (await flash.flash(t)).paintedAt,
      reveal: (t) =>
        renderGrandStaff(stage.current!, {
          key: t.key,
          lh: t.parts.find((p) => p.hand === 'LH')?.pitches,
          rh: t.parts.find((p) => p.hand === 'RH')?.pitches,
          showNames: true,
        }),
      clear: () => drawEmptyStaff(stage.current),
    }
    drawEmptyStaff(stage.current)
    setResults([])
    const s = new DrillSession({
      settings: level.settings,
      generator: createLevelGenerator(level.settings, Math.floor(Math.random() * 1e6)),
      input: scripted,
      presenter,
      totalReps: REPS,
    })
    session.current = s
    s.subscribe((snapshot) => {
      setSnap(snapshot)
      setNow(performance.now()) // a fresh reading, so the countdown starts from the true time left
      setResults([...s.results])
      // While notes are being heard, redraw the staff with a halo on each one that has been heard.
      const t = snapshot.target
      if (t && snapshot.state === 'FLASHED' && snapshot.heard.length > 0 && stage.current) {
        const states = (pitches: { midi: number }[]) =>
          pitches.map((p) => (snapshot.heard.includes(p.midi) ? ('heard' as const) : undefined))
        const lh = t.parts.find((p) => p.hand === 'LH')?.pitches
        const rh = t.parts.find((p) => p.hand === 'RH')?.pitches
        renderGrandStaff(stage.current, {
          key: t.key,
          lh,
          rh,
          lhStates: lh && states(lh),
          rhStates: rh && states(rh),
        })
      }
    })
    await s.start()
  }

  // A running timer for the target that is on screen.
  useEffect(() => {
    if (snap?.state !== 'FLASHED' || snap.t0 === null) return
    const t0 = snap.t0
    const id = setInterval(() => setElapsed(performance.now() - t0), 100)
    return () => clearInterval(id)
  }, [snap?.state, snap?.t0])

  // While counting down to the first target, keep the clock moving so the number changes.
  const countingDown = snap?.state === 'READY' && snap.ready?.first === true
  useEffect(() => {
    if (!countingDown) return
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [countingDown])
  const count =
    countingDown && snap?.ready ? Math.max(0, Math.ceil((snap.ready.at - now) / 1000)) : null

  /** A click on a key is a note struck and let go. */
  const tap = (midi: number) => {
    const i = input.current
    if (!i) return
    i.noteOn(midi, performance.now())
    window.setTimeout(() => i.noteOff(midi, performance.now()), 120)
  }

  const revealed =
    snap?.state === 'INTERSTITIAL' &&
    (snap.lastOutcome === 'timeout' || snap.lastOutcome === 'skipped')
  const marks = new Map<number, KeyMark>()
  if (snap) {
    for (const m of snap.heard) marks.set(m, 'heard')
    for (const e of snap.errors) for (const m of e.notes) if (!marks.has(m)) marks.set(m, 'wrong')
    if (revealed) for (const m of snap.expected) if (!marks.has(m)) marks.set(m, 'target')
  }
  const labels = new Map(
    snap?.target?.parts.flatMap((p) => p.pitches).map((p) => [p.midi, formatPitch(p)]) ?? [],
  )
  const state = snap?.state ?? 'IDLE'
  const running = state !== 'IDLE' && state !== 'ENDED'
  const status: Record<string, string> = {
    IDLE: 'Pick a level and press Start.',
    READY: 'Get ready…',
    FLASHED: 'Play it: click the keys. Each note you get turns green.',
    SUCCESS: 'Got it!',
    TIMEOUT: 'Time is up.',
    SKIPPED: 'Skipped.',
    INTERSTITIAL: revealed ? 'Here was the answer.' : 'Nice. Next one coming…',
    PAUSED: 'Paused. The rep in progress was discarded.',
    ENDED: snap?.completedReps === REPS ? 'Session complete.' : 'Session ended.',
  }

  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Session demo</h1>
      <p className="placeholder">
        Tests the drill's session logic (PD-401). The on-screen keyboard stands in for the piano:
        click a key to play a note. A session is {REPS} targets.
      </p>

      <p>
        <label>
          Level{' '}
          <select
            value={levelId}
            onChange={(e) => setLevelId(Number(e.target.value))}
            disabled={running}
          >
            {PRESET_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <button type="button" onClick={() => void start()} disabled={running}>
          Start
        </button>{' '}
        {state === 'PAUSED' ? (
          <button type="button" onClick={() => session.current?.resume()}>
            Resume
          </button>
        ) : (
          <button type="button" onClick={() => session.current?.pause()} disabled={!running}>
            Pause
          </button>
        )}{' '}
        <button
          type="button"
          onClick={() => session.current?.skip()}
          disabled={state !== 'FLASHED'}
        >
          Skip
        </button>{' '}
        <button type="button" onClick={stop} disabled={!running}>
          End
        </button>
      </p>

      <p role="status">
        <strong>{status[state]}</strong>
        {snap && running && (
          <>
            {' '}
            Rep {Math.min(snap.repNumber, REPS)} of {REPS}
            {state === 'FLASHED' && <> · {(elapsed / 1000).toFixed(1)} s</>}
            {state === 'FLASHED' && (
              <>
                {' '}
                · {snap.heard.length} / {snap.expected.length} notes
              </>
            )}
            {snap.errors.length > 0 && state === 'FLASHED' && <> · {snap.errors.length} wrong</>}
          </>
        )}
      </p>

      <div className="stage">
        <div ref={stage} className="staff" />
        {countingDown && (
          <div className="countdown" role="timer" aria-label="Seconds until the first target">
            {count && count > 0 ? count : '…'}
          </div>
        )}
      </div>
      <PianoKeyboard
        marks={marks}
        labels={labels}
        showNames={revealed}
        onKeyClick={running ? tap : undefined}
        label="On-screen piano"
      />

      <h2>Results</h2>
      {results.length === 0 ? (
        <p className="placeholder">None yet.</p>
      ) : (
        <table className="results">
          <thead>
            <tr>
              <th>Rep</th>
              <th>Outcome</th>
              <th>First note</th>
              <th>All notes</th>
              <th>Wrong notes</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.targetId}>
                <td>{i + 1}</td>
                <td>{OUTCOME_TEXT[r.outcome]}</td>
                <td>{r.reactionMs === null ? '–' : `${(r.reactionMs / 1000).toFixed(2)} s`}</td>
                <td>{r.completionMs === null ? '–' : `${(r.completionMs / 1000).toFixed(2)} s`}</td>
                <td>{r.errors.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
