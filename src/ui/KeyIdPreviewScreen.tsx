import { useState } from 'react'
import { Link } from 'react-router'
import { answerLabel } from '../keyid/labels'
import {
  checkAnswer,
  DEFAULT_KEY_ID_CONFIG,
  KeyIdGenerator,
  type EnharmonicStrictness,
  type KeyIdAnswer,
  type KeyIdConfig,
  type KeyIdFormat,
} from '../keyid/questions'
import { Staff } from '../notation/Staff'
import type { Mode } from '../theory/keys'
import type { Clef } from '../theory/staff'
import { KeyAnswerInput, type AnswerFeedback } from './KeyAnswerInput'

const FORMATS: { value: KeyIdFormat; label: string }[] = [
  { value: 'major', label: 'Name the major key' },
  { value: 'key', label: 'Name the key (tonic shown)' },
  { value: 'signature', label: 'Count the sharps or flats' },
  { value: 'pair', label: 'Major and relative minor' },
]

/** One round of questions for a fixed configuration; remounted when the settings change. */
function Round({ config, seed }: { config: KeyIdConfig; seed: number }) {
  const [generator] = useState(() => new KeyIdGenerator(config, seed))
  const [question, setQuestion] = useState(() => generator.next())
  const [shownAt, setShownAt] = useState(() => performance.now())
  const [result, setResult] = useState<{
    ok: boolean
    ms: number
    feedback: AnswerFeedback
  } | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })

  const answer = (given: KeyIdAnswer) => {
    if (result) return
    const ok = checkAnswer(question, given, config.enharmonic)
    setResult({
      ok,
      ms: performance.now() - shownAt,
      feedback: { correct: question.answer, given, ok },
    })
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }))
  }
  const next = () => {
    setQuestion(generator.next())
    setResult(null)
    setShownAt(performance.now())
  }

  return (
    <>
      <p>
        <strong>{question.prompt}</strong>
      </p>
      <Staff
        clef={question.clef}
        keySignature={question.key}
        notes={question.hint ? [question.hint] : undefined}
        label={`${question.clef} clef staff with a key signature`}
      />
      <KeyAnswerInput
        format={question.format}
        onAnswer={answer}
        disabled={!!result}
        feedback={result?.feedback ?? null}
      />
      {/* The result area always takes the same space, so nothing moves when an answer arrives. */}
      <div className="result-slot" role="status">
        {result && (
          <>
            <strong>
              {result.ok
                ? 'Correct!'
                : `Not quite. The answer is ${answerLabel(question.answer, question.format)}.`}
            </strong>{' '}
            {(result.ms / 1000).toFixed(2)} s{' '}
            <button type="button" onClick={next} ref={(el) => el?.focus({ preventScroll: true })}>
              Next
            </button>
          </>
        )}
      </div>
      <p className="placeholder">
        Score: {score.right} / {score.total}
      </p>
    </>
  )
}

/** Dev screen for PD-501/502: key-signature questions with the answer wheel, grid and typing. (PD-503 builds the real mode.) */
export function KeyIdPreviewScreen() {
  const [config, setConfig] = useState<KeyIdConfig>({ ...DEFAULT_KEY_ID_CONFIG, maxAccidentals: 3 })
  const [seed, setSeed] = useState(1)
  const set = (patch: Partial<KeyIdConfig>) => setConfig((c) => ({ ...c, ...patch }))

  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Key ID preview</h1>
      <p className="placeholder">
        Questions from the generator (PD-501) with the answer input (PD-502). Press Next after each
        answer.
      </p>
      <div className="recorder-form">
        <label>
          Question type
          <select
            value={config.format}
            onChange={(e) => set({ format: e.target.value as KeyIdFormat })}
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Up to this many sharps/flats
          <select
            value={config.maxAccidentals}
            onChange={(e) => set({ maxAccidentals: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Keys
          <select
            value={config.modes}
            onChange={(e) => set({ modes: e.target.value as 'both' | Mode })}
          >
            <option value="both">Major and minor</option>
            <option value="major">Major only</option>
            <option value="minor">Minor only</option>
          </select>
        </label>
        <label>
          Clef
          <select
            value={config.clefs.length === 2 ? 'both' : config.clefs[0]}
            onChange={(e) =>
              set({
                clefs: e.target.value === 'both' ? ['treble', 'bass'] : [e.target.value as Clef],
              })
            }
          >
            <option value="both">Treble and bass</option>
            <option value="treble">Treble</option>
            <option value="bass">Bass</option>
          </select>
        </label>
        <label>
          F♯ and G♭ (same sound, different signature)
          <select
            value={config.enharmonic}
            onChange={(e) => set({ enharmonic: e.target.value as EnharmonicStrictness })}
          >
            <option value="strict">Must match the spelling</option>
            <option value="lenient">Accept either</option>
          </select>
        </label>
        <p>
          <button type="button" onClick={() => setSeed((s) => s + 1)}>
            New random seed
          </button>
        </p>
      </div>
      <Round key={`${JSON.stringify(config)}|${seed}`} config={config} seed={seed} />
    </>
  )
}
