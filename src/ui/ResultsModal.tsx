import type { ReactNode } from 'react'
import { formatTotal } from './formatTotal'

/**
 * The end-of-session results (design §8.3): how many were right and the total time, with anything extra the mode wants
 * to add underneath. Shown only when the session is over; closes with Close, the backdrop or Go again.
 */
export function ResultsModal({
  correct,
  reps,
  totalMs,
  onClose,
  onAgain,
  children,
}: {
  correct: number
  reps: number
  totalMs: number
  onClose: () => void
  onAgain: () => void
  children?: ReactNode
}) {
  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <section className="modal" role="dialog" aria-modal="true" aria-label="Session summary">
        <h2>Session complete</h2>
        <p className="modal-score">
          <strong>
            {correct} of {reps} correct ({reps === 0 ? 0 : Math.round((correct / reps) * 100)}%)
          </strong>
        </p>
        <p>Total time: {formatTotal(totalMs)}</p>
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
