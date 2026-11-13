import { useEffect, useRef, useState } from 'react'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import type { OnScreenKeyboardInput } from '../audio/inputs/OnScreenKeyboardInput'
import { KeyIdSession, type KeyIdAnswerMethod, type KeyIdSnapshot } from '../keyid/KeyIdSession'
import { answerLabel } from '../keyid/labels'
import { KEY_ID_LEVELS } from '../keyid/presets'
import { formatFor, KeyIdGenerator, type KeyIdQuestion } from '../keyid/questions'
import { handFor } from '../keyid/scalePlay'
import {
  mergeKeyIdSettings,
  parseKeyIdSettings,
  toQuestionConfig,
  toSessionSettings,
  type KeyIdSettings,
} from '../keyid/settings'
import { FlashController } from '../notation/flash'
import { renderStaff } from '../notation/renderStaff'
import { summarize } from '../session/summary'
import type { Presenter, RepResult } from '../session/types'
import type { Storage } from '../storage'
import { keySignature } from '../theory/keys'
import { KeyAnswerInput, type AnswerFeedback, type AnswerView } from './KeyAnswerInput'
import { SettingsDrawer } from './SettingsDrawer'
import { levelLabel } from './levelLabel'
import { ScoreSummary } from './ScoreSummary'
import { InputChoiceField } from './InputChoiceField'
import { useCountdown } from './useCountdown'
import { usePianoInput } from './usePianoInput'
import { useRemainingSeconds } from './useRemainingSeconds'

/** A session is always this many questions. */
const DEFAULT_QUESTIONS = 20

const STORAGE_KEY = 'piano-drill.keyid-settings'

function loadSettings(): { settings: KeyIdSettings; levelId: number | 'custom' } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = parseKeyIdSettings(JSON.parse(raw))
      if (parsed.ok) {
        // Changing any option renames the settings "Custom", so a preset's own name means it is still that level.
        const preset = KEY_ID_LEVELS.find((l) => l.settings.name === parsed.settings.name)
        return { settings: parsed.settings, levelId: preset?.id ?? 'custom' }
      }
    }
  } catch {
    // Storage unavailable or corrupt: fall back to the first level.
  }
  return { settings: KEY_ID_LEVELS[0].settings, levelId: KEY_ID_LEVELS[0].id }
}

const drawEmptyStaff = (el: HTMLElement | null) => {
  if (el) renderStaff(el, { clef: 'treble', key: keySignature(0, 'major') })
}

export type KeyIdScreenProps = {
  /** For tests: where results are saved. Defaults to the app's database. */
  storage?: Storage
  /** For tests only: a shorter session than the product's fixed 20 questions. */
  questions?: number
  /** For tests: stands in for the browser's MIDI request (null = a browser with no MIDI). */
  midiAccess?: RequestMidiAccess | null
  /** For tests only: shorter waits than the product's fixed ones. */
  timing?: {
    getReadyMs?: { first: number; between: number }
    feedbackMs?: number
    revealMs?: number
  }
}

/**
 * Key identification (design §7): a key signature is flashed on a treble or bass staff and you name the key, by tapping the
 * wheel, typing, or playing the tonic.
 */
export function KeyIdScreen({
  timing,
  storage,
  midiAccess,
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
  const input = useRef<OnScreenKeyboardInput | null>(null)
  const [snap, setSnap] = useState<KeyIdSnapshot | null>(null)
  const [results, setResults] = useState<RepResult[]>([])
  const count = useCountdown(snap?.ready ?? null)
  const piano = usePianoInput({
    requestAccess: midiAccess,
    onLost: () => session.current?.pause(), // the piano went away: stop, and say so
  })

  useEffect(() => {
    drawEmptyStaff(stage.current)
    return () => session.current?.end()
  }, [])

  const state = snap?.state ?? 'IDLE'
  const running = state !== 'IDLE' && state !== 'ENDED'
  useEffect(() => {
    if (state === 'ENDED') piano.release()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const remaining = useRemainingSeconds(
    state === 'FLASHED',
    snap?.t0 ?? null,
    snap?.limitSeconds ?? null, // longer when the question is answered by playing the scale
  )

  const start = async () => {
    session.current?.end()
    drawEmptyStaff(stage.current)
    setResults([])
    setSnap(null)
    setDismissed(false)
    const drill = await piano.open() // a missing MIDI piano is reported here, before anything starts
    if (!drill) return
    input.current = drill.screen
    const flash = new FlashController<KeyIdQuestion>({
      container: stage.current!,
      render: (into, q) =>
        renderStaff(into, { clef: q.clef, key: q.key, notes: q.hint ? [q.hint] : undefined }),
    })
    const presenter: Presenter<KeyIdQuestion> = {
      prepare: (q) => flash.prepare(q),
      flash: async (q) => (await flash.flash(q)).paintedAt,
      reveal: () => {}, // the answer input marks the right answer and the message says what it was
      clear: () => drawEmptyStaff(stage.current),
    }
    const s = new KeyIdSession({
      settings: toSessionSettings(settings),
      generator: new KeyIdGenerator(toQuestionConfig(settings), Math.floor(Math.random() * 1e6)),
      presenter,
      input: drill.input,
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
    i.press(midi)
    window.setTimeout(() => i.release(midi), 120)
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
    const picked = KEY_ID_LEVELS.find((l) => l.id === Number(value))
    if (picked) changeSettings(picked.settings, picked.id)
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
      ? {
          correct: question.answer,
          given: snap.given,
          ok: snap.lastOutcome === 'correct' || snap.lastOutcome === 'correct_with_errors',
        }
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
      ? last.outcome === 'timeout' || last.outcome === 'skipped'
        ? `${last.outcome === 'timeout' ? "Time's up." : 'Skipped.'} The answer is ${answerLabel(question.answer)}.`
        : '' // a right answer is shown by the green mark alone
      : ''
  // The notes done so far light up green and the last wrong note is marked; if time ran out, the scale is shown.
  const marking = state === 'FLASHED' || finished // not while getting ready for the next question
  const unsolved = last?.outcome === 'timeout' || last?.outcome === 'skipped'
  const scale = snap?.scale ?? []
  const playMarks: { midi: number; kind: 'right' | 'wrong' | 'target' }[] = marking
    ? [
        ...(finished && unsolved ? scale.map((midi) => ({ midi, kind: 'target' as const })) : []),
        ...scale.slice(0, snap?.progress ?? 0).map((midi) => ({ midi, kind: 'right' as const })),
        ...(snap?.wrongPlayed.length
          ? [{ midi: snap.wrongPlayed.at(-1)!, kind: 'wrong' as const }]
          : []),
      ]
    : []
  const summary = state === 'ENDED' && results.length > 0 ? summarize(results) : null
  const format = formatFor(settings.modes)

  return (
    <div className="keyid-screen">
      <h1>Key ID</h1>
      <div className="keyid-bar">
        <button type="button" onClick={() => void start()} disabled={running || piano.starting}>
          Start
        </button>
        {state === 'PAUSED' ? (
          <button
            type="button"
            disabled={piano.lost}
            onClick={() => {
              piano.acknowledge()
              session.current?.resume()
            }}
          >
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

      <p className="keyid-clock">{remaining ?? ''}</p>

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
        wrong={marking ? (snap?.wrong ?? []) : []}
        play={{
          onNote: playNote,
          marks: playMarks,
          progress: snap?.progress ?? 0,
          total: scale.length,
          hand: question ? handFor(question) : 'right',
        }}
        onViewChange={onViewChange}
      />

      <div className={`result-slot${piano.notice ? ' midi-problem' : ''}`} role="status">
        {piano.notice ?? message}
      </div>

      {summary && !dismissed && (
        <ScoreSummary
          mode="keyid"
          levelId={levelId}
          levelName={levelLabel(levelId)}
          goalSeconds={settings.goal?.medianSeconds}
          timeoutSeconds={settings.timeoutSeconds}
          plannedReps={QUESTIONS}
          results={results}
          storage={storage}
          onClose={() => setDismissed(true)}
          onAgain={() => void start()}
        ></ScoreSummary>
      )}

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Key ID settings"
        centered
        narrow
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
        <InputChoiceField value={piano.choice} onChange={piano.setChoice} disabled={running} />
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
