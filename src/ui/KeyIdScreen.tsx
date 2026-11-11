import { useEffect, useRef, useState } from 'react'
import { ScriptedInput } from '../audio/inputs/ScriptedInput'
import { KeyIdSession, type KeyIdAnswerMethod, type KeyIdSnapshot } from '../keyid/KeyIdSession'
import { answerLabel } from '../keyid/labels'
import { KEY_ID_LEVELS } from '../keyid/presets'
import { formatFor, KeyIdGenerator, type KeyIdQuestion } from '../keyid/questions'
import {
  mergeKeyIdSettings,
  parseKeyIdSettings,
  toQuestionConfig,
  toSessionSettings,
  type KeyIdSettings,
} from '../keyid/settings'
import { FlashController } from '../notation/flash'
import { renderStaff } from '../notation/renderStaff'
import { confusions, summarize } from '../session/summary'
import type { Presenter, RepResult } from '../session/types'
import { keySignature } from '../theory/keys'
import { KeyAnswerInput, type AnswerFeedback, type AnswerView } from './KeyAnswerInput'
import { SettingsDrawer } from './SettingsDrawer'
import { useCountdown } from './useCountdown'

/** A session is always this many questions. */
const DEFAULT_QUESTIONS = 20

const STORAGE_KEY = 'piano-drill.keyid-settings'

function loadSettings(): { settings: KeyIdSettings; levelId: number | 'custom' } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = parseKeyIdSettings(JSON.parse(raw))
      if (parsed.ok) return { settings: parsed.settings, levelId: 'custom' }
    }
  } catch {
    // Storage unavailable or corrupt: fall back to the first level.
  }
  return { settings: KEY_ID_LEVELS[0].settings, levelId: KEY_ID_LEVELS[0].id }
}

/** 95 s becomes "1:35". */
const formatTotal = (ms: number) => {
  const sec = Math.round(ms / 1000)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

const drawEmptyStaff = (el: HTMLElement | null) => {
  if (el) renderStaff(el, { clef: 'treble', key: keySignature(0, 'major') })
}

export type KeyIdScreenProps = {
  /** For tests only: a shorter session than the product's fixed 20 questions. */
  questions?: number
  /** For tests only: shorter waits than the product's fixed ones. */
  timing?: {
    getReadyMs?: { first: number; between: number }
    feedbackMs?: number
    revealMs?: number
  }
}

/**
 * Key identification (design §7): a key signature is flashed on a treble staff and you name the key, by tapping the
 * wheel, typing, or playing the tonic.
 */
export function KeyIdScreen({
  timing,
  questions: QUESTIONS = DEFAULT_QUESTIONS,
}: KeyIdScreenProps) {
  const [initial] = useState(loadSettings)
  const [settings, setSettings] = useState<KeyIdSettings>(initial.settings)
  const [levelId, setLevelId] = useState<number | 'custom'>(initial.levelId)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [method, setMethod] = useState<KeyIdAnswerMethod>('tap')
  const stage = useRef<HTMLDivElement>(null)
  const session = useRef<KeyIdSession | null>(null)
  const input = useRef<ScriptedInput | null>(null)
  const [snap, setSnap] = useState<KeyIdSnapshot | null>(null)
  const [results, setResults] = useState<RepResult[]>([])
  const [elapsed, setElapsed] = useState(0)
  const count = useCountdown(snap?.ready ?? null)

  useEffect(() => {
    drawEmptyStaff(stage.current)
    return () => session.current?.end()
  }, [])

  const state = snap?.state ?? 'IDLE'
  const running = state !== 'IDLE' && state !== 'ENDED'

  // A running timer for the question that is on screen.
  useEffect(() => {
    if (state !== 'FLASHED' || snap?.t0 == null) return
    const t0 = snap.t0
    const tick = () => setElapsed(Math.max(0, performance.now() - t0))
    const first = setTimeout(tick, 0) // so a new question never shows the last one's time
    const id = setInterval(tick, 100)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [state, snap?.t0])

  const start = async () => {
    session.current?.end()
    drawEmptyStaff(stage.current)
    setResults([])
    setSnap(null)
    setDismissed(false)
    const flash = new FlashController<KeyIdQuestion>({
      container: stage.current!,
      render: (into, q) =>
        renderStaff(into, { clef: 'treble', key: q.key, notes: q.hint ? [q.hint] : undefined }),
    })
    const presenter: Presenter<KeyIdQuestion> = {
      prepare: (q) => flash.prepare(q),
      flash: async (q) => (await flash.flash(q)).paintedAt,
      reveal: () => {}, // the answer input marks the right answer and the message says what it was
      clear: () => drawEmptyStaff(stage.current),
    }
    // On-screen keys stand in for the piano (and for the microphone, until it can verify notes).
    const scripted = new ScriptedInput()
    input.current = scripted
    const s = new KeyIdSession({
      settings: toSessionSettings(settings),
      generator: new KeyIdGenerator(toQuestionConfig(settings), Math.floor(Math.random() * 1e6)),
      presenter,
      input: scripted,
      method,
      totalReps: QUESTIONS,
      ...timing,
    })
    session.current = s
    s.subscribe((snapshot) => {
      setSnap(snapshot)
      setResults([...s.results])
    })
    await s.start()
  }

  /** Switching to the piano view means answering by playing; any other view means tapping or typing. */
  const onViewChange = (view: AnswerView) => {
    const next: KeyIdAnswerMethod = view === 'play' ? 'play' : 'tap'
    setMethod(next)
    session.current?.setMethod(next)
  }

  /** A click on a piano key is a note struck and let go. */
  const playNote = (midi: number) => {
    const i = input.current
    if (!i) return
    i.noteOn(midi, performance.now())
    window.setTimeout(() => i.noteOff(midi, performance.now()), 120)
  }

  // ----- settings -----
  const changeSettings = (next: KeyIdSettings, level: number | 'custom') => {
    setSettings(next)
    setLevelId(level)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Not saved; the settings still apply for this visit.
    }
  }
  const edit = (patch: Record<string, unknown>) => {
    const r = mergeKeyIdSettings(settings, patch)
    if (r.ok) changeSettings({ ...r.settings, name: 'Custom' }, 'custom')
  }
  const pickLevel = (value: string) => {
    if (value === 'custom') return setLevelId('custom')
    const level = KEY_ID_LEVELS.find((l) => l.id === Number(value))
    if (level) changeSettings(level.settings, level.id)
  }

  // ----- what the screen says -----
  const question = snap?.question ?? null
  const finished =
    state === 'INTERSTITIAL' ||
    state === 'SUCCESS' ||
    state === 'INCORRECT' ||
    state === 'TIMEOUT' ||
    state === 'SKIPPED'
  const last = results.at(-1)
  const feedback: AnswerFeedback | null =
    finished && question && snap?.lastOutcome
      ? { correct: question.answer, given: snap.given, ok: snap.lastOutcome === 'correct' }
      : null
  const status =
    state === 'IDLE'
      ? 'Press Start.'
      : state === 'READY'
        ? 'Get ready…'
        : state === 'PAUSED'
          ? 'Paused. The question on screen was discarded.'
          : state === 'ENDED'
            ? snap?.completedReps === QUESTIONS
              ? 'Session complete.'
              : 'Session ended.'
            : (question?.prompt ?? '')
  const message =
    finished && last && question
      ? last.outcome === 'correct'
        ? '' // a right answer is shown by the green mark alone
        : `${last.outcome === 'timeout' ? "Time's up." : last.outcome === 'skipped' ? 'Skipped.' : 'Not quite.'} The answer is ${answerLabel(question.answer)}.`
      : ''
  const playMark =
    finished && snap?.playedMidi != null
      ? { midi: snap.playedMidi, right: last?.outcome === 'correct' }
      : null
  const summary = state === 'ENDED' && results.length > 0 ? summarize(results) : null
  const mistakes = confusions(results)
  const totalMs = results.reduce(
    (sum, r) => sum + (r.reactionMs ?? (settings.timeoutSeconds ?? 0) * 1000),
    0,
  )
  const format = formatFor(settings.modes)

  return (
    <div className="keyid-screen">
      <h1>Key ID</h1>
      <div className="keyid-bar">
        <button type="button" onClick={() => void start()} disabled={running}>
          Start
        </button>
        {state === 'PAUSED' ? (
          <button type="button" onClick={() => session.current?.resume()}>
            Resume
          </button>
        ) : (
          <button type="button" onClick={() => session.current?.pause()} disabled={!running}>
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={() => session.current?.skip()}
          disabled={state !== 'FLASHED'}
        >
          Skip
        </button>
        <button type="button" onClick={() => session.current?.end()} disabled={!running}>
          End
        </button>
        <button type="button" className="seg" onClick={() => setDrawerOpen(true)}>
          Settings
        </button>
      </div>

      <p className="keyid-status" role="status">
        <strong>{status}</strong>
        {running && snap && state !== 'PAUSED' && (
          <>
            {' '}
            Question {Math.min(snap.repNumber, QUESTIONS)} of {QUESTIONS}
          </>
        )}
      </p>

      <p className="keyid-clock">
        {state === 'FLASHED' && settings.timeoutSeconds !== null
          ? Math.max(0, Math.ceil((settings.timeoutSeconds * 1000 - elapsed) / 1000))
          : ''}
      </p>

      <div className="stage">
        <div ref={stage} className="staff" />
        {count !== null && (
          <div className="countdown" role="timer" aria-label="Seconds until the first question">
            {count > 0 ? count : '…'}
          </div>
        )}
      </div>

      <KeyAnswerInput
        format={format}
        onAnswer={(a) => session.current?.answer(a)}
        disabled={state !== 'FLASHED'}
        feedback={feedback}
        play={{ onNote: playNote, mark: playMark }}
        onViewChange={onViewChange}
      />

      <div className="result-slot" role="status">
        {message}
      </div>

      {summary && !dismissed && (
        <div className="drawer-layer">
          <div className="drawer-backdrop" onClick={() => setDismissed(true)} aria-hidden="true" />
          <section className="modal" role="dialog" aria-modal="true" aria-label="Session summary">
            <h2>Session complete</h2>
            <p className="modal-score">
              <strong>
                {summary.correct} of {summary.reps} correct ({Math.round(summary.accuracy * 100)}%)
              </strong>
            </p>
            <p>Total time: {formatTotal(totalMs)}</p>
            {mistakes.length > 0 && (
              <>
                <h3>Mix-ups</h3>
                <ul>
                  {mistakes.map((m) => (
                    <li key={`${m.correct}-${m.given}`}>
                      {m.correct}: you said {m.given}
                      {m.count > 1 && ` (${m.count}×)`}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="modal-actions">
              <button type="button" onClick={() => setDismissed(true)}>
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissed(true)
                  void start()
                }}
              >
                Go again
              </button>
            </div>
          </section>
        </div>
      )}

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Key ID settings"
      >
        <label>
          Level
          <select value={levelId} onChange={(e) => pickLevel(e.target.value)} disabled={running}>
            <option value="custom">Custom</option>
            {KEY_ID_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {typeof levelId === 'number' && (
          <small className="placeholder">
            {KEY_ID_LEVELS.find((l) => l.id === levelId)?.description}
          </small>
        )}
        <label>
          Up to this many sharps or flats
          <select
            value={settings.maxAccidentals}
            onChange={(e) => edit({ maxAccidentals: Number(e.target.value) })}
            disabled={running}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Keys
          <select
            value={settings.modes}
            onChange={(e) => edit({ modes: e.target.value })}
            disabled={running}
          >
            <option value="major">Major only</option>
            <option value="minor">Minor only</option>
            <option value="both">Major and minor</option>
          </select>
        </label>
        <label>
          Time limit per question
          <select
            value={settings.timeoutSeconds ?? 'none'}
            onChange={(e) =>
              edit({ timeoutSeconds: e.target.value === 'none' ? null : Number(e.target.value) })
            }
            disabled={running}
          >
            <option value="none">No limit</option>
            {[5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </label>
        {running && <small className="placeholder">Settings are locked during a session.</small>}
      </SettingsDrawer>
    </div>
  )
}
