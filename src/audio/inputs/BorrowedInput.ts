import type { NoteInput, NoteInputListener, NoteInputState } from './NoteInput'

/**
 * An input that belongs to someone else (the app's one MIDI connection), lent to a session. Starting it makes sure the
 * connection is up and begins passing its notes on; stopping it only lets go, so the connection stays open for the next
 * session and for the connection strip on the screen.
 */
export class BorrowedInput implements NoteInput {
  private readonly inner: NoteInput
  private readonly listeners = new Set<NoteInputListener>()
  private off: (() => void) | null = null

  constructor(inner: NoteInput) {
    this.inner = inner
  }

  onUpdate(cb: NoteInputListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async start(): Promise<void> {
    await this.inner.start()
    this.off ??= this.inner.onUpdate((s: NoteInputState) => {
      for (const cb of [...this.listeners]) cb(s)
    })
  }

  stop(): void {
    this.off?.()
    this.off = null
  }
}
