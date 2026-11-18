import { PRESET_LEVELS } from '../levels/presets'
import type { DifficultySettings } from '../levels/settings'
import { keyName, keySignature } from '../theory/keys'
import { DifficultyFields } from './DifficultyFields'
import { InputChoiceField } from './InputChoiceField'
import type { RepRun } from './useRepSession'
import type { usePlaySettings } from './usePlaySettings'

const signatureLabel = (n: number): string => {
  const names = `${keyName(keySignature(n, 'major'))} / ${keyName(keySignature(n, 'minor'))}`
  const count =
    n === 0
      ? 'no sharps or flats'
      : `${Math.abs(n)} ${n > 0 ? 'sharp' : 'flat'}${Math.abs(n) > 1 ? 's' : ''}`
  return `${names} (${count})`
}
const SIGNATURES = Array.from({ length: 15 }, (_, i) => i - 7)

/** The fields in the Sight-Read settings window: keys, level or key signature, input, and the difficulty options. */
export function PlaySettingsFields({
  s,
  piano,
  running,
}: {
  s: ReturnType<typeof usePlaySettings>
  piano: RepRun['piano']
  running: boolean
}) {
  const { settings, levelId, level, signature, lastSignature } = s
  return (
    <>
      <fieldset disabled={running}>
        <legend>Keys</legend>
        <div className="segmented" role="radiogroup" aria-label="Keys">
          {(
            [
              ['several', 'Several keys'],
              ['one', 'One key signature'],
            ] as const
          ).map(([value, label]) => {
            const checked = (signature === null ? 'several' : 'one') === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={running}
                onClick={() => !checked && s.pickKeyChoice(value)}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>
      {/* Both stay in the layout (one over the other, the unused one invisible), so the modal never changes size. */}
      <div className="overlay">
        <div className={signature === null ? '' : 'unused'} aria-hidden={signature !== null}>
          <label>
            Level
            <select
              value={levelId}
              onChange={(e) => s.pickLevel(e.target.value)}
              disabled={running || signature !== null}
            >
              <option value="custom">Custom</option>
              {PRESET_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {level && <small className="placeholder">{level.description}</small>}
        </div>
        <div className={signature === null ? 'unused' : ''} aria-hidden={signature === null}>
          <label>
            Key signature
            <select
              value={signature ?? lastSignature}
              onChange={(e) => s.pickSignature(Number(e.target.value))}
              disabled={running || signature === null}
            >
              {SIGNATURES.map((n) => (
                <option key={n} value={n}>
                  {signatureLabel(n)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <InputChoiceField value={piano.choice} onChange={piano.setChoice} disabled={running} />
      <DifficultyFields
        settings={settings as DifficultySettings}
        onEdit={s.edit}
        disabled={running}
        showKeys={false}
        showAccidentals={signature === null}
        showTimeLimit
      />
    </>
  )
}
