import type { InputChoice } from '../audio/inputs/drillInput'

/** Where the notes come from: the on-screen piano or a MIDI piano. The same choice is used by Play and Key ID. */
export function InputChoiceField({
  value,
  onChange,
  disabled,
}: {
  value: InputChoice
  onChange: (choice: InputChoice) => void
  disabled?: boolean
}) {
  return (
    <label>
      Input
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as InputChoice)}
      >
        <option value="screen">On-screen piano</option>
        <option value="midi">MIDI piano (the on-screen piano still works too)</option>
      </select>
    </label>
  )
}
