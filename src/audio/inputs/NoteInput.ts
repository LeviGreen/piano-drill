/** A note-on. `t` is in milliseconds on the same clock as the drill timer. */
export type Onset = { midi: number; t: number }

/** Snapshot emitted whenever the set of sounding notes changes or a note is struck. */
export type NoteInputState = {
  t: number
  /** The MIDI numbers of the notes held down right now. */
  activeNotes: Set<number>
  /** Notes struck since the previous update. */
  onsets: Onset[]
}

export type NoteInputListener = (state: NoteInputState) => void

/**
 * Every input method (MIDI, on-screen keyboard, scripted test input) implements this,
 * so the drill loop and tests share one path.
 */
export interface NoteInput {
  /** Subscribe to updates. Returns an unsubscribe function. */
  onUpdate(cb: NoteInputListener): () => void
  start(): Promise<void>
  stop(): void
}
