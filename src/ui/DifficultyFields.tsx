import type { DifficultySettings, HandMode } from '../levels/settings'
import type { Mode } from '../theory/keys'
import { HandsPicture, NotesPicture } from './HandPictures'
import { ToggleTile } from './ToggleTile'

const NOTE_COUNTS = [
  { value: 1, label: '1 note', note: 'single note' },
  { value: 2, label: '2 notes', note: 'interval' },
  { value: 3, label: '3 notes', note: 'triad' },
  { value: 4, label: '4 notes', note: 'seventh chord' },
] as const

/** Toggle a value in a list, but never remove the last one. */
function toggle<T>(list: T[], value: T): T[] {
  if (!list.includes(value)) return [...list, value]
  return list.length > 1 ? list.filter((x) => x !== value) : list
}

/**
 * The options that shape a play-mode target: which hands, how many notes per hand, how many sharps/flats and which
 * keys. Shared by the Play settings drawer and the Generator preview. `onEdit` receives a partial settings object to
 * merge; the caller keeps the settings valid.
 */
export function DifficultyFields({
  settings,
  onEdit,
  disabled = false,
  showKeys = true,
  showTimeLimit = false,
}: {
  settings: DifficultySettings
  onEdit: (patch: Record<string, unknown>) => void
  disabled?: boolean
  /** The major/minor choice. The Play screen leaves it out: a level keeps the keys it was made with. */
  showKeys?: boolean
  /** The time limit per target. */
  showTimeLimit?: boolean
}) {
  const limits = [5, 10, 20]
  const current = settings.timeoutSeconds
  // A limit that is not one of the usual choices (from a custom file) still shows, rather than a blank box.
  const options =
    current !== null && !limits.includes(current)
      ? [...limits, current].sort((a, b) => a - b)
      : limits
  const handTile = (mode: HandMode, label: string, pic: 'left' | 'right' | 'both') => (
    <ToggleTile
      label={label}
      pressed={settings.hands.includes(mode)}
      onToggle={() => onEdit({ hands: toggle(settings.hands, mode) })}
      disabled={disabled}
    >
      <HandsPicture hands={pic} />
    </ToggleTile>
  )
  return (
    <>
      <fieldset disabled={disabled}>
        <legend>Hands</legend>
        <div className="tiles">
          {handTile('LH', 'Left hand only', 'left')}
          {handTile('RH', 'Right hand only', 'right')}
          {handTile('both', 'Both hands', 'both')}
        </div>
        <small className="placeholder">Pick several to mix them at random.</small>
      </fieldset>

      <fieldset disabled={disabled}>
        <legend>Notes per hand</legend>
        <div className="tiles">
          {NOTE_COUNTS.map((n) => (
            <ToggleTile
              key={n.value}
              label={n.label}
              note={n.note}
              pressed={settings.notesPerHand.includes(n.value)}
              onToggle={() => onEdit({ notesPerHand: toggle(settings.notesPerHand, n.value) })}
              disabled={disabled}
            >
              <NotesPicture count={n.value} />
            </ToggleTile>
          ))}
          <ToggleTile
            label="5 notes"
            note="extended chords, later"
            pressed={false}
            onToggle={() => {}}
            disabled
          >
            <NotesPicture count={5} />
          </ToggleTile>
        </div>
        <small className="placeholder">
          The same choices for one hand or both. With both hands, each hand gets one of these counts
          and together they make one chord.
        </small>
      </fieldset>

      <label>
        Up to this many sharps/flats
        <select
          value={settings.keys.maxAccidentals}
          disabled={disabled}
          onChange={(e) =>
            onEdit({ keys: { maxAccidentals: Number(e.target.value), explicit: undefined } })
          }
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      {showKeys && (
        <label>
          Keys
          <select
            value={settings.keys.modes}
            disabled={disabled}
            onChange={(e) => onEdit({ keys: { modes: e.target.value as 'both' | Mode } })}
          >
            <option value="both">Major and minor</option>
            <option value="major">Major only</option>
            <option value="minor">Minor only</option>
          </select>
        </label>
      )}
      {showTimeLimit && (
        <label>
          Time limit per target
          <select
            value={current ?? 'none'}
            disabled={disabled}
            onChange={(e) =>
              onEdit({ timeoutSeconds: e.target.value === 'none' ? null : Number(e.target.value) })
            }
          >
            <option value="none">No limit</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n} seconds
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  )
}
