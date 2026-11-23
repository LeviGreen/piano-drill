import { useState } from 'react'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import { KeyIdSession, type KeyIdAnswerMethod, type KeyIdSnapshot } from '../keyid/KeyIdSession'
import { answerLabel } from '../keyid/labels'
import { KEY_ID_LEVELS } from '../keyid/presets'
import { formatFor, KeyIdGenerator, type KeyIdQuestion } from '../keyid/questions'
import { handFor, scaleToShow } from '../keyid/checklist'
import { toQuestionConfig, toSessionSettings } from '../keyid/settings'
import { renderStaff } from '../notation/renderStaff'
import type { Storage } from '../storage'
import { keySignature } from '../theory/keys'
import { DrillScreenFrame } from './DrillScreenFrame'
import { KeyAnswerInput, type AnswerFeedback, type AnswerView } from './KeyAnswerInput'
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery'
import { useKeyIdSettings } from './useKeyIdSettings'
import { flashPresenter, useRepSession } from './useRepSession'

/** A session is always this many questions. */
const DEFAULT_QUESTIONS = 20

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
 * wheel, typing, or (with a MIDI piano, on a desktop screen) playing the key as a checklist.
 */
export function KeyIdScreen({
  timing,
  storage,
  midiAccess,
  questions: QUESTIONS = DEFAULT_QUESTIONS,
}: KeyIdScreenProps) {
  const { settings, levelId, draft, edit, pickLevel, save, discard } = useKeyIdSettings()
  const [method, setMethod] = useState<KeyIdAnswerMethod>('wheel')
  const phone = useMediaQuery(PHONE_QUERY)

  const run = useRepSession<KeyIdQuestion, KeyIdSnapshot, KeyIdSession>({
    midiAccess,
    drawEmpty: drawEmptyStaff,
    create: ({ drill, stage }) =>
      new KeyIdSession({
        settings: toSessionSettings(settings),
        generator: new KeyIdGenerator(toQuestionConfig(settings), Math.floor(Math.random() * 1e6)),
        presenter: flashPresenter<KeyIdQuestion>({
          container: stage,
          render: (into, q) => renderStaff(into, { clef: q.clef, key: q.key }),
          reveal: () => {}, // the answer input marks the right answer and the message says what it was
          clear: () => drawEmptyStaff(stage),
        }),
        input: drill.midi ?? undefined, // the on-screen piano only mirrors the keys; it is not an input here
        // Playing needs a MIDI piano (`drill.midi` is there only when it is chosen) and a desktop screen.
        method: method === 'play' && !(drill.midi && !phone) ? 'wheel' : method,
        totalReps: QUESTIONS,
        ...timing,
      }),
  })
  const { snap, state, results, piano } = run

  // The play view is offered only with a MIDI piano (chosen in the Sight-Read settings) and a desktop screen.
  const playable = piano.choice === 'midi' && !phone

  /** The view being answered in is how the question is answered, and so how it is scored. */
  const onViewChange = (view: AnswerView) => {
    setMethod(view)
    run.session.current?.setMethod(view)
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
  const message =
    finished && last && question
      ? last.outcome === 'timeout' || last.outcome === 'skipped'
        ? `${last.outcome === 'timeout' ? "Time's up." : 'Skipped.'} The answer is ${answerLabel(question.answer)}.`
        : '' // a right answer is shown by the green mark alone
      : ''
  // The keys held right now light up (red if out of key); if time ran out, the scale is shown.
  const marking = state === 'FLASHED' || finished // not while getting ready for the next question
  const unsolved = last?.outcome === 'timeout' || last?.outcome === 'skipped'
  const playMarks: { midi: number; kind: 'held' | 'wrong' | 'target' }[] = marking
    ? [
        ...(finished && unsolved && question
          ? scaleToShow(question).map((midi) => ({ midi, kind: 'target' as const }))
          : []),
        ...(state === 'FLASHED'
          ? (snap?.held ?? []).map((h) => ({
              midi: h.midi,
              kind: h.wrong ? ('wrong' as const) : ('held' as const),
            }))
          : []),
      ]
    : []

  return (
    <DrillScreenFrame
      title="Key Signatures"
      run={run}
      itemWord="question"
      total={QUESTIONS}
      playingText={question?.prompt ?? ''}
      message={message}
      score={{
        mode: 'keyid',
        levelId,
        goalSeconds: settings.goal?.medianSeconds,
        timeoutSeconds: settings.timeoutSeconds,
        storage,
      }}
      settingsTitle="Key Signatures settings"
      settingsNarrow
      onSaveSettings={save}
      onDiscardSettings={discard}
      settings={
        <>
          <label>
            Level
            <select
              value={draft.levelId}
              onChange={(e) => pickLevel(e.target.value)}
              disabled={run.running}
            >
              <option value="custom">Custom</option>
              {KEY_ID_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {typeof draft.levelId === 'number' && (
            <small className="placeholder">
              {KEY_ID_LEVELS.find((l) => l.id === draft.levelId)?.description}
            </small>
          )}
          <label>
            Up to this many sharps or flats
            <select
              value={draft.settings.maxAccidentals}
              onChange={(e) => edit({ maxAccidentals: Number(e.target.value) })}
              disabled={run.running}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Keys
            <select
              value={draft.settings.modes}
              onChange={(e) => edit({ modes: e.target.value })}
              disabled={run.running}
            >
              <option value="major">Major only</option>
              <option value="minor">Minor only</option>
              <option value="both">Major and minor</option>
            </select>
          </label>
          <label>
            Time limit per question
            <select
              value={draft.settings.timeoutSeconds ?? 'none'}
              onChange={(e) =>
                edit({ timeoutSeconds: e.target.value === 'none' ? null : Number(e.target.value) })
              }
              disabled={run.running}
            >
              <option value="none">No limit</option>
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n} seconds
                </option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {/* Which mode is wanted. Its line is always there, so nothing moves when it fills in. */}
      <p className="keyid-mode" aria-hidden={!(marking && question)}>
        {marking && question ? (question.answer.mode === 'major' ? 'Major' : 'Minor') : '\u00a0'}
      </p>
      <KeyAnswerInput
        format={formatFor(settings.modes)}
        asked={question?.answer.mode ?? null}
        onAnswer={(a) => run.session.current?.answer(a)}
        disabled={state !== 'FLASHED'}
        feedback={feedback}
        wrong={marking ? (snap?.wrong ?? []) : []}
        play={
          playable
            ? {
                checklist: snap?.checklist ?? [],
                marks: playMarks,
                hand: question ? handFor(question) : 'right',
              }
            : undefined
        }
        playUnavailable={
          playable
            ? undefined
            : phone
              ? 'The MIDI view is for desktop screens, with a MIDI piano.'
              : 'The MIDI view needs a MIDI piano: choose it under Input in the Sight-Read settings.'
        }
        onViewChange={onViewChange}
      />
    </DrillScreenFrame>
  )
}
