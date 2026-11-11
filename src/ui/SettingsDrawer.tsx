import { useEffect, useRef, type ReactNode } from 'react'

/**
 * A panel over the page, so settings stay out of the way of the game: a drawer from the right, or (with `centered`) a
 * wide centred modal for screens with many options. Closes with the Close button, the backdrop or Escape; focus moves into it when it opens and back to where it was when it closes.
 */
export function SettingsDrawer({
  open,
  onClose,
  title,
  centered = false,
  narrow = false,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  /** A wide modal in the middle of the screen instead of a drawer at the side. */
  centered?: boolean
  /** With `centered`: a narrower modal, for a few simple options. */
  narrow?: boolean
  children: ReactNode
}) {
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    panel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus({ preventScroll: true })
    }
  }, [open, onClose])

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
          <button type="button" className="seg" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}
