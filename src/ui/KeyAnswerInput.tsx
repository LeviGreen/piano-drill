import { useEffect, useRef, useState } from 'react'
import { answerLabel } from '../keyid/labels'
import type { KeyIdAnswer, KeyIdFormat } from '../keyid/questions'
import { EMPTY_ENTRY, entryAnswer, entryKey, entryText, type Entry } from '../keyid/shortcuts'
import {
  labelPoint,
  labelRotation,
  sectorPath,
  wheelSectors,
  type WheelSector,
} from '../keyid/wheel'
import { PianoKeyboard, type KeyMark } from '../notation/PianoKeyboard'
import type { Mode } from '../theory/keys'

/** After an answer. `ok` says whether it was right; `given` is null when the player gave no answer (timed out, skipped). */
export type AnswerFeedback = { correct: KeyIdAnswer; given: KeyIdAnswer | null; ok?: boolean }

export type AnswerView = 'wheel' | 'type' | 'play'

type Props = {
  format: KeyIdFormat
  onAnswer: (answer: KeyIdAnswer) => void
  disabled?: boolean
  /** The wrong keys named so far in this question: they stay marked ✕ and cannot be picked again. */
  wrong?: KeyIdAnswer[]
  /** When the question is over: marks the right answer (and, if it was given by tapping, which one was chosen). */
  feedback?: AnswerFeedback | null
  /**
   * Offers a third way to answer: playing the key's scale on a piano keyboard, up and back down, with one hand. `onNote`
   * receives each key played, `marks` shows which keys were right, wrong or (after a miss) the notes to play, and
   * `progress` of `total` notes are done.
   */
  play?: {
    onNote: (midi: number) => void
    marks: { midi: number; kind: 'right' | 'wrong' | 'target' }[]
    progress: number
    total: number
    hand: 'left' | 'right'
  }
  /** Told when the player switches between wheel, type and play. */
  onViewChange?: (view: AnswerView) => void
}

const SECTORS = wheelSectors()

const TYPE_HELP: Record<KeyIdFormat, string> = {
  major: 'A  Bb  C  Dm  Ebm  F#  G#m',
  minor: 'A  Bb  C  D  Eb  F#  G#',
  key: 'A  Bb  C  Dm  Ebm  F#  G#m',
}

const sameAnswer = (a: KeyIdAnswer, b: KeyIdAnswer) =>
  a.accidentals === b.accidentals && a.mode === b.mode
const is = (s: { accidentals: number; mode: Mode }, a: KeyIdAnswer | null | undefined) =>
  !!a && sameAnswer(s, a)
const sectorAnswer = (s: WheelSector): KeyIdAnswer => ({ accidentals: s.accidentals, mode: s.mode })

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
 * Where the player names a key: a circle-of-fifths wheel (major keys outside, relative minors inside), a text box with no picture at all (so there is nothing to count around), or by playing the key's scale. Every key
 * can also be typed anywhere: a letter, then # or b, then m for minor, then Enter.
 */
export function KeyAnswerInput({
  format,
  onAnswer,
  disabled = false,
  wrong = [],
  feedback = null,
  play,
  onViewChange,
}: Props) {
  const [view, setView] = useState<AnswerView>('wheel')
  const [entry, setEntry] = useState<Entry>(EMPTY_ENTRY)
  const typeBox = useRef<HTMLInputElement>(null)
  // The keyboard listener is attached once per format, so it reads the latest entry and callback through refs.
  const entryRef = useRef(entry)
  const onAnswerRef = useRef(onAnswer)
  useEffect(() => {
    entryRef.current = entry
    onAnswerRef.current = onAnswer
  })
  const shownView: AnswerView = view === 'play' && !play ? 'wheel' : view
  const typing = shownView === 'type'
  const choose_view = (v: AnswerView) => {
    setView(v)
    onViewChange?.(v)
  }

  // A new question (or a locked/unlocked input) starts with nothing typed.
  const [seen, setSeen] = useState({ format, disabled })
  if (seen.format !== format || seen.disabled !== disabled) {
    setSeen({ format, disabled })
    setEntry(EMPTY_ENTRY)
  }

  useEffect(() => {
    if (disabled || shownView === 'play') return
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
        const answer = entryAnswer(entryRef.current)
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
  }, [format, disabled, shownView])

  /** One key typed into the text box: the same rules as the global shortcuts. */
  const typeKey = (key: string) => {
    const result = entryKey(entryRef.current, key, format)
    if (result.submit) {
      const answer = entryAnswer(entryRef.current)
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

  const pending = entryAnswer(entry)
  // Was the answer right? The caller can say; otherwise it means "same as the right one".
  const accepted = feedback
    ? (feedback.ok ?? (feedback.given !== null && sameAnswer(feedback.given, feedback.correct)))
    : null
  // Time ran out (or they skipped) without the right answer: it is shown, in the "to play" colour like in Play.
  const revealed = accepted === false && feedback?.given === null
  const wasWrong = (a: KeyIdAnswer) => wrong.some((w) => sameAnswer(w, a))
  const lastWrong = wrong.at(-1) ?? null
  // After a wrong guess the box shows it in red until you start typing the next one.
  const showingWrong = !feedback && !entry.letter && lastWrong !== null
  const choose = (a: KeyIdAnswer) => {
    if (disabled || wasWrong(a)) return
    setEntry(EMPTY_ENTRY)
    onAnswer(a)
  }

  const views: AnswerView[] = play ? ['wheel', 'type', 'play'] : ['wheel', 'type']
  const viewLabel: Record<AnswerView, string> = {
    wheel: 'Wheel',
    type: 'Type',
    play: 'Play',
  }

  const playMarks = new Map<number, KeyMark>()
  for (const m of play?.marks ?? [])
    playMarks.set(m.midi, m.kind === 'right' ? 'heard' : m.kind === 'wrong' ? 'wrong' : 'target')

  return (
    <div className="answer-input">
      <div className="answer-views" role="group" aria-label="Answer layout">
        {views.map((v) => (
          <button
            key={v}
            type="button"
            className="seg"
            aria-pressed={shownView === v}
            onClick={() => choose_view(v)}
          >
            {viewLabel[v]}
          </button>
        ))}
      </div>

      {shownView === 'wheel' && (
        <svg
          className="wheel"
          viewBox="0 0 200 200"
          role="group"
          aria-label="Circle of fifths: major keys outside, relative minors inside"
        >
          {SECTORS.map((s) => {
            const enabled = !disabled && !wasWrong(s) && (format === 'key' || s.mode === format)
            const isReveal = revealed && is(s, feedback?.correct)
            const isCorrect =
              !revealed &&
              (is(s, feedback?.correct) || (accepted === true && is(s, feedback?.given)))
            const isWrong =
              !isCorrect && ((accepted === false && is(s, feedback?.given)) || wasWrong(s))
            const isPending = is(s, pending)
            const p = labelPoint(s)
            const cls = [
              'wheel-key',
              s.mode,
              s.split ? 'split' : '',
              isPending ? 'pending' : '',
              isCorrect ? 'correct' : '',
              isReveal ? 'reveal' : '',
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
                onClick={() => enabled && choose(sectorAnswer(s))}
                onKeyDown={(e) => {
                  if (enabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    choose(sectorAnswer(s))
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
                {(isCorrect || isWrong || isReveal) && (
                  <text x={p.x} y={p.y + (s.mode === 'major' ? 8 : 7)} className="wheel-mark">
                    {isCorrect ? '✓' : isReveal ? '●' : '✕'}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {typing && (
        <div className="type-answer">
          <input
            ref={typeBox}
            className={[
              'type-box',
              accepted === true ? 'correct' : '',
              revealed ? 'reveal' : '',
              (accepted === false && !revealed) || showingWrong ? 'wrong' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Your answer"
            value={
              feedback
                ? feedback.given
                  ? answerLabel(feedback.given)
                  : revealed
                    ? answerLabel(feedback.correct)
                    : ''
                : showingWrong
                  ? answerLabel(lastWrong)
                  : entryText(entry)
            }
            disabled={disabled}
            inputMode="text"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={() => {}} // the value is driven by key handling; typing never edits it directly
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey || e.altKey) return
              if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Backspace') {
                e.preventDefault()
                typeKey(e.key)
              }
            }}
          />
          {!disabled && !feedback && entry.letter === null && !showingWrong && (
            <span className="type-hint" aria-hidden="true">
              {TYPE_HELP[format]}
            </span>
          )}
          {(accepted !== null || showingWrong) && (
            <span className="type-mark" aria-hidden="true">
              {accepted ? '✓' : revealed ? '●' : '✕'}
            </span>
          )}
        </div>
      )}

      {shownView === 'play' && play && (
        <PianoKeyboard
          marks={playMarks}
          onKeyClick={disabled ? undefined : play.onNote}
          label="Piano: play the scale"
        />
      )}

      <p className="answer-pending" aria-live="polite">
        {disabled
          ? '' // what the right answer was is for the screen around this to say; the input only marks right and wrong
          : shownView === 'play'
            ? `Play the key's scale up and back down with your ${play?.hand} hand (a wrong note starts you over). ${play?.progress ?? 0} / ${play?.total ?? 0}`
            : typing
              ? '' // the box shows what is typed, with the help as its placeholder
              : entryText(entry) ||
                'Tap an answer, or type it: a letter, then # or b, then m for minor, then Enter.'}
      </p>
    </div>
  )
}
