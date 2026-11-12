import { useState, type ReactNode } from 'react'
import { formatTotal } from './formatTotal'

/**
 * The end-of-session results (design §8.3): the score, big, and nothing else until you ask. Hover the score (or tap or
 * press it, which keeps the details open) for the breakdown: how many were right, how many wrong notes or guesses,
 * and the total time, plus anything extra the mode wants to add. Closes with Close, the backdrop or Go again.
 */
export function ResultsModal({
  correct,
  reps,
  totalMs,
  score,
  maxScore,
  wrong,
  wrongLabel,
  onClose,
  onAgain,
  details,
  children,
}: {
  correct: number
  reps: number
  totalMs: number
  /** The arcade score, when there is one, and the most it could have been. */
  score?: number
  maxScore?: number
  /** Wrong notes (Play) or wrong guesses (Key ID) over the session, and what to call them. */
  wrong?: number
  wrongLabel?: string
  onClose: () => void
  onAgain: () => void
  /** Extra lines for the breakdown (mix-ups, wrong notes). */
  details?: ReactNode
  /** What goes below the score (the high-score entry, links). */
  children?: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const open = hovered || pinned
  const fmt = (n: number) => n.toLocaleString('en-US')
  const percent = reps === 0 ? 0 : Math.round((correct / reps) * 100)

  const breakdown = (
    <div
      id="score-breakdown"
      className="score-breakdown"
      role="region"
      aria-label="Score breakdown"
    >
      <p>
        <strong>
          {correct} of {reps} correct ({percent}%)
        </strong>
      </p>
      {wrong !== undefined && (
        <p>
          {wrongLabel ?? 'Wrong'}: {wrong}
        </p>
      )}
      <p>Total time: {formatTotal(totalMs)}</p>
      {details}
    </div>
  )

  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="modal" role="dialog" aria-modal="true" aria-label="Session summary">
        <h2>Session complete</h2>
        {score !== undefined ? (
          <div
            className="score-wrap"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              type="button"
              className="modal-points"
              aria-label="Score"
              aria-expanded={open}
              aria-controls="score-breakdown"
              onClick={() => setPinned((p) => !p)}
            >
              <strong>{fmt(score)}</strong>
              {maxScore !== undefined && <small> / {fmt(maxScore)}</small>}
              <span className="info" aria-hidden="true">
                ⓘ
              </span>
            </button>
            {open && breakdown}
          </div>
        ) : (
          breakdown
        )}
        {children}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              onAgain()
            }}
          >
            Go again
          </button>
        </div>
      </section>
    </div>
  )
}
