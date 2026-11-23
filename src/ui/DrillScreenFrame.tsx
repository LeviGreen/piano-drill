import { useState, type ReactNode } from 'react'
import type { Storage } from '../storage'
import { levelLabel } from './levelLabel'
import { signatureLabel } from './signatureLabel'
import { ScoreSummary } from './ScoreSummary'
import { SettingsDrawer } from './SettingsDrawer'
import type { RepRun } from './useRepSession'

export type DrillScore = {
  mode: 'play' | 'keyid'
  /** The level played, or 'custom'. */
  levelId: number | 'custom'
  /** Sight-Read on a single key: its signature, which has its own board. Null or absent: several keys. */
  keySignature?: number | null
  /** The level's goal time, for the speed bonus. */
  goalSeconds?: number
  timeoutSeconds: number | null
  /** For tests: where scores are saved. Defaults to the app's database. */
  storage?: Storage
}

/**
 * The layout every drill screen shares: the title, the Start / Pause / Skip / End / Settings bar, the status line, the
 * clock, the staff with its get-ready countdown, a place for what the mode puts under the staff (its keyboard or answer
 * box), the message line, the results window and the settings drawer. A mode fills in the slots and says what its items
 * are called; the session itself comes from `useRepSession`.
 */
export function DrillScreenFrame({
  title,
  className = '',
  run,
  itemWord,
  total,
  playingText,
  message,
  score,
  settingsTitle,
  settingsNarrow,
  settings,
  onSaveSettings,
  onDiscardSettings,
  children,
}: {
  title: string
  /** Added to the screen's own class, for styles only that mode has. */
  className?: string
  run: RepRun
  /** What the items are called, lower case: "target" or "question". */
  itemWord: 'target' | 'question'
  /** How many items a session has. */
  total: number
  /** The status line while an item is on screen ("Play it!", or the question). */
  playingText: string
  /** The line under the answer area: what the answer was after a miss. */
  message: string
  score: DrillScore
  settingsTitle: string
  settingsNarrow?: boolean
  /** The settings fields, shown in the drawer (locked while a session runs). */
  settings: ReactNode
  /** Save pressed: keep the draft the fields have been editing. */
  onSaveSettings: () => void
  /** The window closed without Save (Close, outside click, Escape): drop the draft. */
  onDiscardSettings: () => void
  /** What sits between the staff and the message line. */
  children: ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { state, snap, running, piano, results, dismissed, stage, count, remaining } = run
  const word = itemWord[0].toUpperCase() + itemWord.slice(1)
  const status =
    state === 'IDLE'
      ? 'Press Start.'
      : state === 'READY'
        ? 'Get ready…'
        : state === 'PAUSED'
          ? `Paused. The ${itemWord} on screen was discarded.`
          : state === 'ENDED'
            ? snap?.completedReps === total
              ? 'Session complete.'
              : 'Session ended.'
            : playingText

  return (
    <div className={`keyid-screen ${className}`.trim()}>
      <h1>{title}</h1>
      <div className="keyid-bar">
        <button type="button" onClick={run.start} disabled={running || piano.starting}>
          Start
        </button>
        {state === 'PAUSED' ? (
          <button type="button" disabled={piano.lost} onClick={run.resume}>
            Resume
          </button>
        ) : (
          <button type="button" onClick={run.pause} disabled={!running}>
            Pause
          </button>
        )}
        <button type="button" onClick={run.skip} disabled={state !== 'FLASHED'}>
          Skip
        </button>
        <button type="button" onClick={run.end} disabled={!running}>
          End
        </button>
        <button type="button" className="seg" onClick={() => setDrawerOpen(true)}>
          Settings
        </button>
      </div>

      <p className="keyid-status" role="status">
        <strong>{status}</strong>
        {running && snap && state !== 'PAUSED' && (
          <>
            {' '}
            {word} {Math.min(snap.repNumber, total)} of {total}
          </>
        )}
      </p>

      <p className="keyid-clock">{remaining ?? ''}</p>

      <div className="stage">
        <div ref={stage} className="staff" />
        {count !== null && (
          <div
            className="countdown"
            role="timer"
            aria-label={`Seconds until the first ${itemWord}`}
          >
            {count > 0 ? count : '…'}
          </div>
        )}
      </div>

      {children}

      <div className={`result-slot${piano.notice ? ' midi-problem' : ''}`} role="status">
        {piano.notice ?? message}
      </div>

      {state === 'ENDED' && results.length > 0 && !dismissed && (
        <ScoreSummary
          mode={score.mode}
          levelId={score.levelId}
          levelName={
            score.keySignature == null
              ? levelLabel(score.levelId)
              : `${levelLabel(score.levelId)}, ${signatureLabel(score.keySignature)}`
          }
          keySignature={score.keySignature ?? null}
          goalSeconds={score.goalSeconds}
          timeoutSeconds={score.timeoutSeconds}
          plannedReps={total}
          results={results}
          storage={score.storage}
          onClose={run.dismiss}
          onAgain={run.start}
        />
      )}

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          onDiscardSettings()
        }}
        onSave={() => {
          onSaveSettings()
          setDrawerOpen(false)
        }}
        saveDisabled={running}
        title={settingsTitle}
        centered
        narrow={settingsNarrow}
      >
        {settings}
        {running && <small className="placeholder">Settings are locked during a session.</small>}
      </SettingsDrawer>
    </div>
  )
}
