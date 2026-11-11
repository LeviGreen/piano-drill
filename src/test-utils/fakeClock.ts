import type { Clock } from '../session/types'

/**
 * A clock the test controls: nothing happens until `advance` is called, timers fire in order, and `now()`
 * reads exactly the time each timer was due. After each timer it lets pending promises run.
 */
export class FakeClock implements Clock {
  private time = 0
  private nextId = 1
  private timers: { id: number; due: number; fn: () => void }[] = []

  now(): number {
    return this.time
  }

  setTimeout(fn: () => void, ms: number): number {
    const id = this.nextId++
    this.timers.push({ id, due: this.time + Math.max(0, ms), fn })
    return id
  }

  clearTimeout(id: number): void {
    this.timers = this.timers.filter((t) => t.id !== id)
  }

  get pendingTimers(): number {
    return this.timers.length
  }

  /** Move time forward, running every timer that falls due (and the promise callbacks they cause). */
  async advance(ms: number): Promise<void> {
    const end = this.time + ms
    await flush()
    for (;;) {
      const next = this.timers
        .filter((t) => t.due <= end)
        .sort((a, b) => a.due - b.due || a.id - b.id)[0]
      if (!next) break
      this.timers = this.timers.filter((t) => t.id !== next.id)
      this.time = Math.max(this.time, next.due)
      next.fn()
      await flush()
    }
    this.time = end
  }
}

/** Let queued promise callbacks run. */
export async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
