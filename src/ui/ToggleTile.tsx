import type { ReactNode } from 'react'

/** A picture button that toggles on and off like a checkbox (aria-pressed), with a ✓ badge when on. */
export function ToggleTile({
  pressed,
  onToggle,
  label,
  note,
  disabled,
  children,
}: {
  pressed: boolean
  onToggle: () => void
  label: string
  note?: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="tile"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
    >
      {children}
      <span className="tile-label">{label}</span>
      {note && <span className="tile-note">{note}</span>}
      <span className="tile-check" aria-hidden="true">
        ✓
      </span>
    </button>
  )
}
