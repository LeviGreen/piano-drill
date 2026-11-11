import { useEffect, useRef } from 'react'
import { formatPitch, pitchFromMidi } from '../theory/pitch'
import { keyboardLayout, WHITE_H } from './keyboardLayout'

/** How a key is marked: part of the target (to play), heard, only weakly heard, or heard but wrong. */
export type KeyMark = 'target' | 'heard' | 'almost' | 'wrong'

const SYMBOL: Record<KeyMark, string> = { target: '●', heard: '✓', almost: '~', wrong: '✕' }
const WORD: Record<KeyMark, string> = {
  target: 'to play',
  heard: 'heard',
  almost: 'almost heard',
  wrong: 'wrong note heard',
}

export type PianoKeyboardProps = {
  /** First and last key, both white. Default G2 to F5, the MVP range. */
  low?: number
  high?: number
  marks?: Map<number, KeyMark>
  /** Names to print on marked keys (default: sharp spellings). */
  labels?: Map<number, string>
  showNames?: boolean
  /** Makes the keys clickable (e.g. to play on screen or to cycle a note's state). */
  onKeyClick?: (midi: number) => void
  /**
   * Real key presses, for playing: `onKeyPress` when a finger or click lands on a key and `onKeyRelease` when it lets
   * go (wherever it is by then). Several fingers at once press several keys. Replaces `onKeyClick`.
   */
  onKeyPress?: (midi: number) => void
  onKeyRelease?: (midi: number) => void
  label?: string
}

/**
 * A piano keyboard diagram. Marked keys show their state by shape as well as color: a dot for a target key,
 * a check mark for heard, a dashed outline for almost, a cross for a wrong note.
 */
export function PianoKeyboard({
  low = 43,
  high = 77,
  marks,
  labels,
  showNames,
  onKeyClick,
  onKeyPress,
  onKeyRelease,
  label = 'Piano keyboard',
}: PianoKeyboardProps) {
  // pointer id -> the key that finger or click is holding
  const down = useRef(new Map<number, number>())
  const release = useRef(onKeyRelease)
  useEffect(() => {
    release.current = onKeyRelease
  })
  useEffect(() => {
    if (!onKeyPress) return
    const held = down.current
    const up = (e: PointerEvent) => {
      const midi = held.get(e.pointerId)
      if (midi === undefined) return
      held.delete(e.pointerId)
      release.current?.(midi)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      for (const midi of held.values()) release.current?.(midi)
      held.clear()
    }
  }, [onKeyPress])
  const { keys, width } = keyboardLayout(low, high)
  // Names sit below the keyboard: white keys on one line, black keys on a second line beneath it.
  const height = WHITE_H + 20
  return (
    <svg className="keyboard" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={label}>
      {keys.map((k) => {
        const mark = marks?.get(k.midi)
        const name = labels?.get(k.midi) ?? formatPitch(pitchFromMidi(k.midi))
        const cx = k.x + k.width / 2
        const markY = k.black ? k.height - 8 : k.height - 18
        const props = onKeyPress
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': `${name}${mark ? `, ${WORD[mark]}` : ''}`,
              onPointerDown: (e: React.PointerEvent) => {
                e.preventDefault()
                down.current.set(e.pointerId, k.midi)
                onKeyPress(k.midi)
              },
              onKeyDown: (e: React.KeyboardEvent) => {
                if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
                  e.preventDefault()
                  onKeyPress(k.midi)
                }
              },
              onKeyUp: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') onKeyRelease?.(k.midi)
              },
            }
          : onKeyClick
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': `${name}${mark ? `, ${WORD[mark]}` : ''}`,
                onClick: () => onKeyClick(k.midi),
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onKeyClick(k.midi)
                  }
                },
              }
            : {}
        return (
          <g
            key={k.midi}
            className={`kb-key ${k.black ? 'black' : 'white'} ${mark ?? ''}`}
            data-midi={k.midi}
            {...props}
          >
            <rect x={k.x} y={0} width={k.width} height={k.height} rx={1.5} />
            {mark && (
              <text className="kb-mark" x={cx} y={markY} textAnchor="middle">
                {SYMBOL[mark]}
              </text>
            )}
            {mark && showNames && (
              <text className="kb-name" x={cx} y={WHITE_H + (k.black ? 15 : 7)} textAnchor="middle">
                {name}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
