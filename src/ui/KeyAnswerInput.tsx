import { useEffect, useRef, useState } from 'react'
import { answerLabel, signatureLabel } from '../keyid/labels'
import type { KeyIdAnswer, KeyIdFormat } from '../keyid/questions'
import { EMPTY_ENTRY, entryAnswer, entryKey, entryText, type Entry } from '../keyid/shortcuts'
import {
  labelPoint,
  labelRotation,
  sectorPath,
  wheelSectors,
  type WheelSector,
} from '../keyid/wheel'
import { keyName, keySignature, type Mode } from '../theory/keys'

/** After an answer. `ok` says whether it was accepted (an enharmonic answer can be accepted without matching exactly). */
export type AnswerFeedback = { correct: KeyIdAnswer; given: KeyIdAnswer; ok?: boolean }

type Props = {
  format: KeyIdFormat
  onAnswer: (answer: KeyIdAnswer) => void
  disabled?: boolean
  /** After an answer: marks the right answer and a wrong choice. */
  feedback?: AnswerFeedback | null
}

const SECTORS = wheelSectors()

const TYPE_HELP: Record<KeyIdFormat, string> = {
  major: 'Type a key, e.g. e b, then Enter',
  key: 'Type a key, e.g. f # m, then Enter',
  pair: 'Type either key of the pair, then Enter',
  signature: 'Type a number then # or b, e.g. 3 b, then Enter',
}

/** What picking this sector means as an answer in each format. */
function sectorAnswer(s: WheelSector, format: KeyIdFormat): KeyIdAnswer {
  if (format === 'key') return { accidentals: s.accidentals, mode: s.mode }
  if (format === 'major') return { accidentals: s.accidentals, mode: 'major' }
  return { accidentals: s.accidentals }
}

/** Is this sector part of the given answer? (Pair answers light up both rings.) */
function inAnswer(s: WheelSector, a: KeyIdAnswer | null | undefined, format: KeyIdFormat): boolean {
  if (!a || a.accidentals !== s.accidentals) return false
  if (format === 'pair' || format === 'signature') return true
  return (a.mode ?? 'major') === s.mode
}

/** Do two answers say the same thing in this format? */
function sameAnswer(a: KeyIdAnswer, b: KeyIdAnswer, format: KeyIdFormat): boolean {
  if (a.accidentals !== b.accidentals) return false
  if (format === 'key') return a.mode === b.mode
  return true
}

const sharpFlat = (n: number) => (n === 0 ? '0' : `${Math.abs(n)}${n > 0 ? '♯' : '♭'}`)

/** Is the keyboard event aimed at something the user is typing into? Then it is not an answer shortcut. */
function typingElsewhere(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null
  if (!el) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

/**
 * Where the user gives a key-ID answer: a circle-of-fifths wheel (major keys outside, relative minors inside), a
 * button grid, or number buttons for the signature format. Every key can also be typed: a letter, then # or b,
 * then m for minor, then Enter.
 */
export function KeyAnswerInput({ format, onAnswer, disabled = false, feedback = null }: Props) {
  const [view, setView] = useState<'wheel' | 'grid' | 'type'>('wheel')
  const typeBox = useRef<HTMLInputElement>(null)
  const [gridMode, setGridMode] = useState<Mode>('major')
  const [entry, setEntry] = useState<Entry>(EMPTY_ENTRY)
  // The keyboard listener is attached once per format, so it reads the latest entry and callback through refs.
  const entryRef = useRef(entry)
  const onAnswerRef = useRef(onAnswer)
  useEffect(() => {
    entryRef.current = entry
    onAnswerRef.current = onAnswer
  })
  // Counting buttons have no wheel, so the wheel choice means the grid there.
  const shownView = format === 'signature' && view === 'wheel' ? 'grid' : view
  const useWheel = shownView === 'wheel'
  const typing = shownView === 'type'

  // A new question (or a locked/unlocked input) starts with nothing typed.
  const [seen, setSeen] = useState({ format, disabled })
  if (seen.format !== format || seen.disabled !== disabled) {
    setSeen({ format, disabled })
    setEntry(EMPTY_ENTRY)
  }

  useEffect(() => {
    if (disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingElsewhere(e)) return
      const target = e.target as HTMLElement | null
      // Enter/Space on a focused answer button is that button's own click.
      if ((e.key === 'Enter' || e.key === ' ') && target?.closest('[role="button"], button')) return
      const result = entryKey(entryRef.current, e.key, format)
      const handled = result.submit || result.entry !== entryRef.current
      if (!handled) return
      e.preventDefault()
      if (result.submit) {
        const answer = entryAnswer(entryRef.current, format)
        if (answer) {
          setEntry(EMPTY_ENTRY)
          onAnswerRef.current(answer)
        }
        return
      }
      setEntry(result.entry)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [format, disabled])

  /** One key typed into the text box: the same rules as the global shortcuts. */
  const typeKey = (key: string) => {
    const result = entryKey(entryRef.current, key, format)
    if (result.submit) {
      const answer = entryAnswer(entryRef.current, format)
      if (answer) {
        entryRef.current = EMPTY_ENTRY
        setEntry(EMPTY_ENTRY)
        onAnswerRef.current(answer)
      }
      return
    }
    entryRef.current = result.entry
    setEntry(result.entry)
  }

  const typeKeyRef = useRef(typeKey)
  useEffect(() => {
    typeKeyRef.current = typeKey
  })

  // Text typed into the box (from a physical or on-screen keyboard) arrives as the browser's native `beforeinput`
  // event, which carries the typed characters. React's own onBeforeInput does not, so listen directly.
  useEffect(() => {
    const box = typeBox.current
    if (!typing || !box) return
    const onBeforeInput = (e: Event) => {
      const ev = e as InputEvent
      ev.preventDefault() // the box never edits itself; it only shows the answer being built
      if (ev.inputType === 'deleteContentBackward') typeKeyRef.current('Backspace')
      else if (ev.data) for (const ch of ev.data) typeKeyRef.current(ch)
    }
    box.addEventListener('beforeinput', onBeforeInput)
    return () => box.removeEventListener('beforeinput', onBeforeInput)
  }, [typing])

  // In Type mode the box takes focus (without scrolling the page) whenever a question is waiting for an answer.
  useEffect(() => {
    if (typing && !disabled) typeBox.current?.focus({ preventScroll: true })
  }, [typing, disabled, format])

  const pending = entryAnswer(entry, format)
  // Was the answer accepted? The caller can say (e.g. an enharmonic answer); otherwise it means "same as the right one".
  const accepted = feedback
    ? (feedback.ok ?? sameAnswer(feedback.given, feedback.correct, format))
    : null
  const choose = (a: KeyIdAnswer) => {
    if (disabled) return
    setEntry(EMPTY_ENTRY)
    onAnswer(a)
  }

  return (
    <div className="answer-input">
      <div className="answer-views" role="group" aria-label="Answer layout">
        {(format === 'signature'
          ? (['grid', 'type'] as const)
          : (['wheel', 'grid', 'type'] as const)
        ).map((v) => (
          <button
            key={v}
            type="button"
            className="seg"
            aria-pressed={shownView === v}
            onClick={() => setView(v)}
          >
            {v === 'wheel' ? 'Wheel' : v === 'grid' ? 'Grid' : 'Type'}
          </button>
        ))}
      </div>

      {useWheel && (
        <svg
          className="wheel"
          viewBox="0 0 200 200"
          role="group"
          aria-label="Circle of fifths: major keys outside, relative minors inside"
        >
          {SECTORS.map((s) => {
            const enabled = !disabled && (format !== 'major' || s.mode === 'major')
            const a = sectorAnswer(s, format)
            const isCorrect =
              inAnswer(s, feedback?.correct, format) ||
              (accepted === true && inAnswer(s, feedback?.given, format))
            const isWrong = !isCorrect && accepted === false && inAnswer(s, feedback?.given, format)
            const isPending =
              inAnswer(s, pending, format) && (format !== 'pair' ? true : s.mode === 'major')
            const p = labelPoint(s)
            const cls = [
              'wheel-key',
              s.mode,
              s.split ? 'split' : '',
              isPending ? 'pending' : '',
              isCorrect ? 'correct' : '',
              isWrong ? 'wrong' : '',
              enabled ? '' : 'off',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <g
                key={`${s.accidentals}${s.mode}`}
                className={cls}
                role="button"
                aria-label={s.name}
                aria-disabled={!enabled}
                tabIndex={enabled ? 0 : -1}
                onClick={() => enabled && choose(a)}
                onKeyDown={(e) => {
                  if (enabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    choose(a)
                  }
                }}
              >
                <path d={sectorPath(s)} />
                <text
                  x={p.x}
                  y={p.y}
                  className="wheel-label"
                  transform={`rotate(${labelRotation(s)} ${p.x} ${p.y})`}
                >
                  {s.label}
                </text>
                {(isCorrect || isWrong) && (
                  <text x={p.x} y={p.y + (s.mode === 'major' ? 8 : 7)} className="wheel-mark">
                    {isCorrect ? '✓' : '✕'}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {!useWheel && !typing && (
        <>
          {format === 'key' && (
            <div className="answer-views" role="group" aria-label="Major or minor">
              {(['major', 'minor'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="seg"
                  aria-pressed={gridMode === m}
                  onClick={() => setGridMode(m)}
                >
                  {m === 'major' ? 'Major' : 'Minor'}
                </button>
              ))}
            </div>
          )}
          <div className="answer-grid">
            {Array.from({ length: 15 }, (_, i) => i - 7).map((n) => {
              const mode = format === 'major' ? 'major' : gridMode
              const a: KeyIdAnswer =
                format === 'signature'
                  ? { accidentals: n }
                  : format === 'pair'
                    ? { accidentals: n }
                    : { accidentals: n, mode }
              const key = keySignature(n, mode)
              const text =
                format === 'signature'
                  ? sharpFlat(n)
                  : format === 'pair'
                    ? `${keySignature(n, 'major').tonic.letter}${['𝄫', '♭', '', '♯', '𝄪'][keySignature(n, 'major').tonic.accidental + 2]} / ${keySignature(n, 'minor').tonic.letter}${['𝄫', '♭', '', '♯', '𝄪'][keySignature(n, 'minor').tonic.accidental + 2]}m`
                    : `${key.tonic.letter}${['𝄫', '♭', '', '♯', '𝄪'][key.tonic.accidental + 2]}${mode === 'minor' ? 'm' : ''}`
              const name =
                format === 'signature'
                  ? signatureLabel(n)
                  : format === 'pair'
                    ? answerLabel(a, 'pair')
                    : keyName(key)
              const matches = (x: KeyIdAnswer | null | undefined) =>
                !!x &&
                x.accidentals === n &&
                (format !== 'key' || x.mode === mode) &&
                (format !== 'major' || (x.mode ?? 'major') === 'major')
              const isCorrect =
                matches(feedback?.correct) || (accepted === true && matches(feedback?.given))
              const isWrong = !isCorrect && accepted === false && matches(feedback?.given)
              const isPending = matches(pending)
              return (
                <button
                  key={n}
                  type="button"
                  className={[
                    'answer-btn',
                    isPending ? 'pending' : '',
                    isCorrect ? 'correct' : '',
                    isWrong ? 'wrong' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={name}
                  disabled={disabled}
                  onClick={() => choose(a)}
                >
                  {text}
                  {(isCorrect || isWrong) && (
                    <span className="answer-mark" aria-hidden="true">
                      {isCorrect ? '✓' : '✕'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}

      {typing && (
        <div className="type-answer">
          <input
            ref={typeBox}
            className={[
              'type-box',
              accepted === true ? 'correct' : '',
              accepted === false ? 'wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Your answer"
            value={feedback ? answerLabel(feedback.given, format) : entryText(entry, format)}
            disabled={disabled}
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={TYPE_HELP[format]}
            onChange={() => {}} // the value is driven by key handling; typing never edits it directly
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey || e.altKey) return
              if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault()
                typeKey(e.key)
              }
            }}
          />
          {accepted !== null && (
            <span className="type-mark" aria-hidden="true">
              {accepted ? '✓' : '✕'}
            </span>
          )}
        </div>
      )}

      <p className="answer-pending" aria-live="polite">
        {disabled
          ? '' // what the right answer was is for the screen around this to say; the input only marks right and wrong
          : typing
            ? '' // the box shows what is typed, with the help as its placeholder
            : entryText(entry, format) ||
              'Tap an answer, or type it: a letter, then # or b, then m for minor, then Enter.'}
      </p>
    </div>
  )
}
