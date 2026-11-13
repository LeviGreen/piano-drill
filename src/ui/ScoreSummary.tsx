import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import {
  correctCount,
  FALLBACK_GOAL_SECONDS,
  maxScore,
  sessionScore,
  totalTimeMs,
} from '../scoring/score'
import type { RepResult } from '../session/types'
import { getStorage, type Storage, type StoredMode } from '../storage'
import { ResultsModal } from './ResultsModal'

const INITIALS_KEY = 'piano-drill.initials'

const lastInitials = (): string => {
  try {
    return localStorage.getItem(INITIALS_KEY) ?? ''
  } catch {
    return ''
  }
}

export type ScoreSummaryProps = {
  mode: StoredMode
  /** A preset level's number, or 'custom': only preset levels have a high-score board. */
  levelId: number | 'custom'
  levelName: string
  /** The level's goal time, which the speed bonus is measured against. */
  goalSeconds: number | undefined
  timeoutSeconds: number | null
  /** How many targets the session was meant to have. */
  plannedReps: number
  results: RepResult[]
  /** For tests: where to save. Defaults to the app's database. */
  storage?: Storage
  onClose: () => void
  onAgain: () => void
  /** Extra detail for this mode, shown under the totals. */
  children?: ReactNode
}

/**
 * The end-of-session results: the arcade score, how many were right and the total time. It also saves the session
 * (kept for later) and, for a finished session on a preset level that makes the top ten, asks for three
 * initials, like an old arcade game.
 */
export function ScoreSummary({
  mode,
  levelId,
  levelName,
  goalSeconds,
  timeoutSeconds,
  plannedReps,
  results,
  storage,
  onClose,
  onAgain,
  children,
}: ScoreSummaryProps) {
  const db = storage ?? getStorage()
  const score = sessionScore(results, goalSeconds ?? FALLBACK_GOAL_SECONDS)
  const correct = correctCount(results)
  const totalMs = totalTimeMs(results, timeoutSeconds)
  const wrong = results.reduce((n, r) => n + r.errors.length, 0)
  const finished = results.length === plannedReps
  const level = String(levelId)
  const eligible = typeof levelId === 'number' && finished

  const [prospective, setProspective] = useState<number | null | undefined>(undefined) // undefined: still checking
  const [initials, setInitials] = useState(lastInitials)
  const [placed, setPlaced] = useState<number | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const sessionId = results[0]?.sessionId
  const checked = useRef<string | null>(null)

  // Find out, once per session, whether the score makes the board. Only high scores are kept, not every session.
  useEffect(() => {
    if (!sessionId || checked.current === sessionId) return
    checked.current = sessionId
    void (async () => {
      try {
        setProspective(eligible ? await db.prospectiveRank(mode, level, score) : null)
      } catch {
        setFailed(true) // no storage (a private window, say): the results still show
        setProspective(null)
      }
    })()
    // Checked once per session id, with the values it ended with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const save = async () => {
    const name = initials.replace(/[^A-Z]/g, '')
    if (!name || placed !== undefined) return
    try {
      localStorage.setItem(INITIALS_KEY, name)
    } catch {
      // Not remembered; fine.
    }
    try {
      setPlaced(
        await db.addScore({
          id: `${sessionId}-score`,
          mode,
          level,
          initials: name,
          score,
          correct,
          wrong,
          reps: results.length,
          totalMs,
          achievedAt: new Date().toISOString(),
        }),
      )
    } catch {
      setFailed(true)
    }
  }

  return (
    <ResultsModal
      correct={correct}
      reps={results.length}
      totalMs={totalMs}
      score={score}
      maxScore={maxScore(plannedReps, results)}
      wrong={wrong}
      wrongLabel={mode === 'play' ? 'Wrong notes' : 'Wrong guesses'}
      onClose={onClose}
      onAgain={onAgain}
      details={children}
    >
      <div className="board-note" role="status">
        {!eligible ? (
          <small>Only finished sessions on the preset levels go on the high-score board.</small>
        ) : prospective === undefined ? null : prospective === null ? (
          <small>Not in the top ten on {levelName}.</small>
        ) : placed === undefined ? (
          <form
            className="initials-form"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            <strong className="new-high">New high score! #{prospective}</strong>
            <span className="board-level">on {levelName}</span>
            <label htmlFor="initials">Your initials</label>
            <input
              id="initials"
              className="initials-input"
              value={initials}
              maxLength={3}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="AAA"
              onChange={(e) => setInitials(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            />
            <button type="submit" disabled={initials.length === 0}>
              Save
            </button>
          </form>
        ) : (
          <strong>
            Saved! You are #{placed} on {levelName}.
          </strong>
        )}
        {failed && <small>Could not save to this browser's storage.</small>}
      </div>
      <p>
        <Link to="/scores">High scores</Link>
      </p>
    </ResultsModal>
  )
}
