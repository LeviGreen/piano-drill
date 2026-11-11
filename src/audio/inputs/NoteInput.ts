/** A detected note-on. `t` is in milliseconds on the same clock as the drill timer. */
export type Onset = { midi: number; t: number; confidence: number }

/** Snapshot emitted whenever the set of sounding notes changes or an onset is detected. */
export type NoteInputState = {
  t: number
  /** Currently sounding notes: MIDI number -> confidence (0..1). */
  activeNotes: Map<number, number>
  /** Onsets detected since the previous update. */
  onsets: Onset[]
}

export type NoteInputListener = (state: NoteInputState) => void

/**
 * Every input method (mic, MIDI, on-screen keyboard, scripted test input) implements this,
 * so the drill loop and tests share one path.
 */
export interface NoteInput {
  /** Subscribe to updates. Returns an unsubscribe function. */
  onUpdate(cb: NoteInputListener): () => void
  start(): Promise<void>
  stop(): void
}
