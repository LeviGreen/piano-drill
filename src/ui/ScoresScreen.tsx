import { useEffect, useState, type ReactNode } from 'react'
import { KEY_ID_LEVELS } from '../keyid/presets'
import { PRESET_LEVELS } from '../levels/presets'
import { getStorage, type ScoreRecord, type Storage, type StoredMode } from '../storage'
import { formatTotal } from './formatTotal'
import { SettingsDrawer } from './SettingsDrawer'
import { PHONE_QUERY, useMediaQuery } from './useMediaQuery'

const MODES: { value: StoredMode; label: string }[] = [
  { value: 'play', label: 'Play' },
  { value: 'keyid', label: 'Key ID' },
]
const levelsFor = (mode: StoredMode) => (mode === 'play' ? PRESET_LEVELS : KEY_ID_LEVELS)
const date = (iso: string) => iso.slice(0, 10)
const fmt = (n: number) => n.toLocaleString('en-US')
const wrongWord = (mode: StoredMode) => (mode === 'play' ? 'Wrong notes' : 'Wrong guesses')

/** Loads something from storage; null while loading or if storage is unavailable. */
function useLoaded<T>(load: () => Promise<T>, deps: unknown[]): T | null {
  const [value, setValue] = useState<{ deps: unknown[]; data: T } | null>(null)
  useEffect(() => {
    let live = true
    load()
      .then((data) => live && setValue({ deps, data }))
      .catch(() => live && setValue(null))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value && value.deps.every((d, i) => d === deps[i]) ? value.data : null
}

/** On a phone the tables show only the essentials; tapping the score shows the rest in a small pop-up. */
function Detail({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <SettingsDrawer open onClose={onClose} title={title} centered narrow>
      <div className="score-detail">{children}</div>
    </SettingsDrawer>
  )
}

/** The score as a button that opens the breakdown (phones only). */
function ScoreButton({ score, onOpen }: { score: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="score-link"
      onClick={onOpen}
      aria-label={`${fmt(score)}, show details`}
    >
      {fmt(score)}
    </button>
  )
}

/** A board always shows ten lines: the scores there are, then blank lines to fill it up. */
const BOARD_LINES = 10

function Board({
  storage,
  mode,
  level,
  compact,
}: {
  storage: Storage
  mode: StoredMode
  level: string
  compact: boolean
}) {
  const loaded: ScoreRecord[] | null = useLoaded(
    () => storage.topScores(mode, level),
    [mode, level],
  )
  const scores = loaded ?? [] // while loading the board is simply empty, so nothing jumps when it fills in
  const [open, setOpen] = useState<number | null>(null)
  const shown = open === null ? null : scores[open]
  const cells = compact ? 3 : 6

  return (
    <>
      <table className={`results board${compact ? ' compact' : ''}`}>
        <thead>
          <tr>
            <th>#</th>
            <th>Initials</th>
            <th>Score</th>
            {!compact && (
              <>
                <th>Correct</th>
                <th>Wrong</th>
                <th>Time</th>
              </>
            )}
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: BOARD_LINES }, (_, i) => {
            const s = scores[i]
            return s ? (
              <tr key={s.id}>
                <td>{i + 1}</td>
                <td className="initials">{s.initials}</td>
                <td>
                  {compact ? (
                    <ScoreButton score={s.score} onOpen={() => setOpen(i)} />
                  ) : (
                    fmt(s.score)
                  )}
                </td>
                {!compact && (
                  <>
                    <td>
                      {s.correct} / {s.reps}
                    </td>
                    <td>{s.wrong ?? '–'}</td>
                    <td>{formatTotal(s.totalMs)}</td>
                  </>
                )}
                <td>{date(s.achievedAt)}</td>
              </tr>
            ) : (
              <tr key={`blank-${i}`} className="blank">
                <td>{i + 1}</td>
                {Array.from({ length: cells }, (_, c) => (
                  <td key={c} />
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      {shown && compact && (
        <Detail
          title={`#${open! + 1} ${shown.initials}: ${fmt(shown.score)}`}
          onClose={() => setOpen(null)}
        >
          <p>
            <strong>
              {shown.correct} of {shown.reps} correct (
              {shown.reps === 0 ? 0 : Math.round((shown.correct / shown.reps) * 100)}%)
            </strong>
          </p>
          <p>
            {wrongWord(mode)}: {shown.wrong ?? '–'}
          </p>
          <p>Total time: {formatTotal(shown.totalMs)}</p>
          <p>{date(shown.achievedAt)}</p>
        </Detail>
      )}
    </>
  )
}

/** The high-score board for each level: top ten, three initials, separately for Play and Key ID. */
export function ScoresScreen({ storage }: { storage?: Storage }) {
  const db = storage ?? getStorage()
  const compact = useMediaQuery(PHONE_QUERY)
  const [mode, setMode] = useState<StoredMode>('play')
  const [levelId, setLevelId] = useState(1)
  const levels = levelsFor(mode)

  return (
    <div className="scores-screen">
      <h1>High scores</h1>
      <div className="keyid-bar" role="group" aria-label="Mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            className="seg"
            aria-pressed={mode === m.value}
            onClick={() => {
              setMode(m.value)
              setLevelId(1)
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p>
        <select
          aria-label="Level"
          value={levelId}
          onChange={(e) => setLevelId(Number(e.target.value))}
        >
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </p>
      <Board storage={db} mode={mode} level={String(levelId)} compact={compact} />
    </div>
  )
}
