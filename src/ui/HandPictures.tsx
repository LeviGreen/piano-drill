import type { ReactNode } from 'react'

/**
 * Small vector illustrations: a hand seen from above resting on five white piano keys. Fingers are
 * numbered 1 (thumb) to 5 (pinky); pressed fingers and their keys are filled with the accent color.
 */

const KEY_W = 20
const KEY_TOP = 6
const KEY_H = 80
const PALM_TOP = 58
const FINGER_BOTTOM = 66
// Fingertip height per finger (thumb, index, middle, ring, pinky): the middle finger reaches furthest.
const FINGER_TOP = [36, 22, 16, 22, 32]

type Side = 'left' | 'right'

function Hand({ side, x0, pressed }: { side: Side; x0: number; pressed: number[] }) {
  // Right hand: thumb on the lowest (left-most) key. Left hand is the mirror image.
  const slot = (finger: number) => (side === 'right' ? finger - 1 : 5 - finger)
  const fingers = [1, 2, 3, 4, 5]
  return (
    <g>
      {fingers.map((f) => {
        const x = x0 + slot(f) * KEY_W
        const down = pressed.includes(f)
        return (
          <rect
            key={`k${f}`}
            x={x}
            y={KEY_TOP}
            width={KEY_W}
            height={KEY_H}
            className={down ? 'key down' : 'key'}
          />
        )
      })}
      <rect x={x0 + 2} y={PALM_TOP} width={5 * KEY_W - 4} height={28} rx={12} className="palm" />
      {fingers.map((f) => {
        const x = x0 + slot(f) * KEY_W + 3
        const top = FINGER_TOP[f - 1]
        return (
          <rect
            key={`f${f}`}
            x={x}
            y={top}
            width={KEY_W - 6}
            height={FINGER_BOTTOM - top}
            rx={(KEY_W - 6) / 2}
            className={pressed.includes(f) ? 'finger down' : 'finger'}
          />
        )
      })}
    </g>
  )
}

function Picture({
  width,
  label,
  children,
}: {
  width: number
  label: string
  children: ReactNode
}) {
  return (
    <svg className="hand-picture" viewBox={`0 0 ${width} 92`} role="img" aria-label={label}>
      {children}
    </svg>
  )
}

/** Left hand, right hand, or both hands resting on the keys. */
export function HandsPicture({ hands }: { hands: 'left' | 'right' | 'both' }) {
  if (hands === 'both') {
    return (
      <Picture width={216} label="Both hands resting on the piano keys">
        <Hand side="left" x0={4} pressed={[]} />
        <Hand side="right" x0={112} pressed={[]} />
      </Picture>
    )
  }
  return (
    <Picture
      width={108}
      label={`${hands === 'left' ? 'Left' : 'Right'} hand resting on the piano keys`}
    >
      <Hand side={hands} x0={4} pressed={[]} />
    </Picture>
  )
}

// Which of five neighbouring keys are pressed for each notes-per-hand choice.
const KEYS_DOWN: Record<number, number[]> = {
  1: [3],
  2: [1, 5],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 4, 5],
}

/** Five piano keys with `count` of them pressed (no hand), for the notes-per-hand choice. */
export function NotesPicture({ count }: { count: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <Picture width={108} label={`${count} ${count === 1 ? 'key' : 'keys'} pressed`}>
      {[1, 2, 3, 4, 5].map((k) => {
        const down = KEYS_DOWN[count].includes(k)
        const x = 4 + (k - 1) * KEY_W
        return (
          <g key={k}>
            <rect
              x={x}
              y={KEY_TOP}
              width={KEY_W}
              height={KEY_H}
              className={down ? 'key down' : 'key'}
            />
            {down && (
              <circle cx={x + KEY_W / 2} cy={KEY_TOP + KEY_H - 14} r={5} className="key-dot" />
            )}
          </g>
        )
      })}
    </Picture>
  )
}
