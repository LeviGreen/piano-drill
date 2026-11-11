/**
 * Flashing a target on screen with an honest start time (PD-204).
 *
 * The drill timer must start when the target is actually visible. So the next target is rendered off-screen
 * ahead of time (`prepare`), then swapped in with a single DOM operation (`flash`), and `onPainted` reports
 * when the browser has shown it. That moment, `paintedAt`, is t0 for the timer.
 */
export type FlashTiming = {
  id: number
  /** Time spent rendering this target off-screen, in ms (0 if it was rendered late, at flash time). */
  prerenderMs: number
  /** Time the DOM swap itself took, in ms. */
  swapMs: number
  /** performance.now() right after the new content went into the DOM. */
  swappedAt: number
  /** Start of the animation frame that first includes the swap (the requestAnimationFrame timestamp). */
  frameStart: number
  /** performance.now() just after that frame was painted. Use this as t0. */
  paintedAt: number
  /** True when nothing was prepared in advance, so rendering happened inside the flash. */
  late: boolean
}

export type FlashOptions<T> = {
  container: HTMLElement
  /** Draw `item` into `into` (an element that is not on the page when called from `prepare`). */
  render: (into: HTMLElement, item: T) => void
  /** Called exactly once per flash, after the new content has been painted. */
  onPainted?: (timing: FlashTiming) => void
  // Injectable for tests; the defaults use the browser.
  now?: () => number
  requestFrame?: (cb: (frameStart: number) => void) => void
  /** Run `cb` after the frame that was just scheduled has been painted. */
  afterPaint?: (cb: () => void) => void
}

type Prepared<T> = { item: T; buffer: HTMLElement; prerenderMs: number }

/** Runs a callback in a task after the current frame has been painted (a message is handled after rendering). */
function defaultAfterPaint(cb: () => void): void {
  const channel = new MessageChannel()
  channel.port1.onmessage = () => {
    channel.port1.close()
    cb()
  }
  channel.port2.postMessage(null)
}

export class FlashController<T> {
  private readonly opts: FlashOptions<T>
  private readonly now: () => number
  private readonly requestFrame: (cb: (frameStart: number) => void) => void
  private readonly afterPaint: (cb: () => void) => void
  private prepared: Prepared<T> | null = null
  private nextId = 1
  private disposed = false

  constructor(opts: FlashOptions<T>) {
    this.opts = opts
    this.now = opts.now ?? (() => performance.now())
    this.requestFrame = opts.requestFrame ?? ((cb) => requestAnimationFrame(cb))
    this.afterPaint = opts.afterPaint ?? defaultAfterPaint
  }

  /** True when a target has been rendered off-screen and is ready to flash. */
  get ready(): boolean {
    return this.prepared !== null
  }

  /** Render `item` off-screen so the next flash is just a swap. A newer call replaces an older one. */
  prepare(item: T): void {
    const buffer = document.createElement('div')
    const t0 = this.now()
    this.opts.render(buffer, item)
    this.prepared = { item, buffer, prerenderMs: this.now() - t0 }
  }

  /**
   * Show the prepared target (or `item`, rendered on the spot if it was not prepared). Returns a promise
   * that settles with the timing once the target has been painted.
   */
  flash(item?: T): Promise<FlashTiming> {
    if (this.disposed) return Promise.reject(new Error('FlashController was disposed'))
    let ready = this.prepared
    this.prepared = null
    const late = !ready || (item !== undefined && ready.item !== item)
    if (late) {
      if (item === undefined)
        return Promise.reject(
          new Error('Nothing prepared to flash: call prepare() first or pass an item'),
        )
      const buffer = document.createElement('div')
      this.opts.render(buffer, item)
      ready = { item, buffer, prerenderMs: 0 }
    }
    const { buffer, prerenderMs } = ready!
    const id = this.nextId++

    const swapStart = this.now()
    this.opts.container.replaceChildren(...Array.from(buffer.childNodes)) // one atomic swap
    const swappedAt = this.now()

    return new Promise((resolve) => {
      this.requestFrame((frameStart) => {
        this.afterPaint(() => {
          const timing: FlashTiming = {
            id,
            prerenderMs,
            swapMs: swappedAt - swapStart,
            swappedAt,
            frameStart,
            paintedAt: this.now(),
            late,
          }
          if (!this.disposed) {
            this.opts.onPainted?.(timing)
            resolve(timing)
          }
        })
      })
    })
  }

  /** Stop reporting: pending flashes will not call onPainted. */
  dispose(): void {
    this.disposed = true
    this.prepared = null
  }
}
