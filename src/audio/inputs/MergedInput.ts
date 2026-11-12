import type { NoteInput, NoteInputListener, NoteInputState } from './NoteInput'

/**
 * Several inputs heard as one: a real piano and the on-screen piano at the same time, say. The notes held are everything
 * held on any of them, and each note played on any of them is an onset, so a drill does not care where a note came from.
 */
export class MergedInput implements NoteInput {
  private readonly inputs: NoteInput[]
  private readonly latest: Map<number, number>[]
  private readonly listeners = new Set<NoteInputListener>()
  private readonly offs: (() => void)[] = []

  constructor(inputs: NoteInput[]) {
    this.inputs = inputs
    this.latest = inputs.map(() => new Map())
    inputs.forEach((input, i) => {
      this.offs.push(
        input.onUpdate((s) => {
          this.latest[i] = new Map(s.activeNotes)
          this.emit(s)
        }),
      )
    })
  }

  onUpdate(cb: NoteInputListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Starts them in order; if one cannot start, the ones already started are stopped again and the error is passed on. */
  async start(): Promise<void> {
    const started: NoteInput[] = []
    try {
      for (const input of this.inputs) {
        await input.start()
        started.push(input)
      }
    } catch (e) {
      for (const input of started) input.stop()
      throw e
    }
  }

  stop(): void {
    for (const input of this.inputs) input.stop()
    this.latest.forEach((_, i) => (this.latest[i] = new Map()))
  }

  private emit(from: NoteInputState): void {
    const activeNotes = new Map<number, number>()
    for (const held of this.latest)
      for (const [midi, confidence] of held)
        activeNotes.set(midi, Math.max(confidence, activeNotes.get(midi) ?? 0))
    const state: NoteInputState = { t: from.t, activeNotes, onsets: from.onsets }
    for (const cb of [...this.listeners]) cb(state)
  }
}
