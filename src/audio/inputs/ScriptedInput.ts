import type { NoteInput, NoteInputListener, Onset } from './NoteInput'

export type ScriptEvent =
  | { type: 'on'; midi: number; t: number; confidence?: number }
  | { type: 'off'; midi: number; t: number }

/**
 * Test/fake NoteInput with caller-controlled timestamps. Events are ignored while stopped,
 * so tests can check that a session only reacts to input after start().
 */
export class ScriptedInput implements NoteInput {
  private listeners = new Set<NoteInputListener>()
  private active = new Map<number, number>()
  private running = false

  onUpdate(cb: NoteInputListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async start(): Promise<void> {
    this.running = true
  }

  stop(): void {
    this.running = false
    this.active.clear()
  }

  noteOn(midi: number, t: number, confidence = 1): void {
    if (!this.running) return
    this.active.set(midi, confidence)
    this.emit(t, [{ midi, t, confidence }])
  }

  noteOff(midi: number, t: number): void {
    if (!this.running || !this.active.delete(midi)) return
    this.emit(t, [])
  }

  /** Play a list of events in timestamp order (stable for equal timestamps). */
  play(events: ScriptEvent[]): void {
    const ordered = events
      .map((e, i) => [e, i] as const)
      .sort(([a, i], [b, j]) => a.t - b.t || i - j)
    for (const [e] of ordered) {
      if (e.type === 'on') this.noteOn(e.midi, e.t, e.confidence)
      else this.noteOff(e.midi, e.t)
    }
  }

  private emit(t: number, onsets: Onset[]): void {
    const state = { t, activeNotes: new Map(this.active), onsets }
    for (const cb of [...this.listeners]) cb(state)
  }
}
