import { ScriptedInput } from './ScriptedInput'

/**
 * The on-screen piano as a NoteInput (PD-302). Pressing a key is a note-on and letting go is a note-off, stamped with
 * the drill's clock, so any number of fingers at once give the combined set of sounding notes (a chord).
 * It stands in for a piano until the microphone can listen, and doubles as a demo mode.
 */
export class OnScreenKeyboardInput extends ScriptedInput {
  /** Fingers (or clicks) currently holding each key, so a key stays down until the last one lets go. */
  private readonly holds = new Map<number, number>()

  press(midi: number): void {
    this.holds.set(midi, (this.holds.get(midi) ?? 0) + 1)
    if (this.holds.get(midi) === 1) this.noteOn(midi, performance.now())
  }

  release(midi: number): void {
    const n = this.holds.get(midi)
    if (n === undefined) return
    if (n > 1) {
      this.holds.set(midi, n - 1)
      return
    }
    this.holds.delete(midi)
    this.noteOff(midi, performance.now())
  }

  stop(): void {
    this.holds.clear()
    super.stop()
  }
}
