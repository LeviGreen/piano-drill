import { PRESET_LEVELS } from '../levels/presets'
import type { DifficultySettings } from '../levels/settings'
import { AccidentalsField, HandsField, NotesPerHandField, TimeLimitField } from './DifficultyFields'
import { InputChoiceField } from './InputChoiceField'
import { SIGNATURES, signatureLabel } from './signatureLabel'
import type { RepRun } from './useRepSession'
import type { usePlaySettings } from './usePlaySettings'

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
  const { settings, levelId, level, signature, lastSignature } = s.draft
  return (
    <>
      <fieldset disabled={running}>
        <legend>Keys</legend>
        <div className="segmented" role="radiogroup" aria-label="Keys">
          {(
            [
              ['several', 'Several keys'],
              ['one', 'Single key'],
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
      <label>
        Level
        <select value={levelId} onChange={(e) => s.pickLevel(e.target.value)} disabled={running}>
          <option value="custom">Custom</option>
          {PRESET_LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      {level && <small className="placeholder">{level.description}</small>}
      {/* The two stay in the layout (one over the other, the unused one invisible), so the modal never changes size. */}
      <div className="overlay">
        <div className={signature === null ? '' : 'unused'} aria-hidden={signature !== null}>
          <AccidentalsField
            settings={settings as DifficultySettings}
            onEdit={s.edit}
            disabled={running || signature !== null}
          />
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
      <HandsField settings={settings as DifficultySettings} onEdit={s.edit} disabled={running} />
      <NotesPerHandField
        settings={settings as DifficultySettings}
        onEdit={s.edit}
        disabled={running}
      />
      <InputChoiceField
        value={piano.draftChoice}
        onChange={piano.setDraftChoice}
        disabled={running}
      />
      <TimeLimitField
        settings={settings as DifficultySettings}
        onEdit={s.edit}
        disabled={running}
      />
    </>
  )
}
