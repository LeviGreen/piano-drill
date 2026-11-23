import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A panel over the page, so settings stay out of the way of the game: a drawer from the right, or (with `centered`) a
 * wide centred modal for screens with many options. Closes with the Close button, the backdrop or Escape; focus moves into it when it opens and back to where it was when it closes.
 * With `onSave` it also has a Save button: the window edits a draft, Save keeps it, and every other way out (`onClose`) leaves things as they were.
 */
export function SettingsDrawer({
  open,
  onClose,
  onSave,
  saveDisabled = false,
  title,
  centered = false,
  narrow = false,
  children,
}: {
  open: boolean
  /** Called for Close, a click outside and Escape: the draft is dropped by the caller. */
  onClose: () => void
  /** Shows a Save button that calls this; the caller keeps the draft and closes the window. */
  onSave?: () => void
  saveDisabled?: boolean
  title: string
  /** A wide modal in the middle of the screen instead of a drawer at the side. */
  centered?: boolean
  /** With `centered`: a narrower modal, for a few simple options. */
  narrow?: boolean
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)

  // The latest onClose, so a parent re-render (every edit of a draft) does not re-run the effect and pull focus back.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus({ preventScroll: true })
    }
  }, [open])

  if (!open) return null
  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panel}
        className={centered ? `modal settings-modal${narrow ? ' narrow' : ''}` : 'drawer'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="drawer-head">
          <h2>{title}</h2>
          <div className="drawer-buttons">
            <button type="button" className="seg" onClick={onClose}>
              Close
            </button>
            {onSave && (
              <button type="button" onClick={onSave} disabled={saveDisabled}>
                Save
              </button>
            )}
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}
