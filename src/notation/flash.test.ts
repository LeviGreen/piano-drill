import { beforeAll, describe, expect, it, vi } from 'vitest'
import { FlashController, type FlashTiming } from './flash'
import { renderGrandStaff } from './renderGrandStaff'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

/** A controllable browser: a clock, a frame queue and an after-paint queue the test steps by hand. */
function fakeBrowser() {
  let time = 1000
  const frames: ((t: number) => void)[] = []
  const paints: (() => void)[] = []
  return {
    now: () => (time += 1),
    requestFrame: (cb: (t: number) => void) => void frames.push(cb),
    afterPaint: (cb: () => void) => void paints.push(cb),
    /** Run the next animation frame, then the paint that follows it. */
    nextFrame: () => {
      time += 5 // the frame starts a little later than the swap
      frames.shift()?.(time)
      paints.shift()?.()
    },
    advance: (ms: number) => (time += ms),
    pending: () => frames.length,
  }
}

const text = (into: HTMLElement, item: string) => void (into.textContent = item)

function setup(overrides: Partial<ConstructorParameters<typeof FlashController<string>>[0]> = {}) {
  const container = document.createElement('div')
  container.textContent = 'old'
  const browser = fakeBrowser()
  const painted: FlashTiming[] = []
  const controller = new FlashController<string>({
    container,
    render: text,
    onPainted: (t) => painted.push(t),
    now: browser.now,
    requestFrame: browser.requestFrame,
    afterPaint: browser.afterPaint,
    ...overrides,
  })
  return { container, browser, painted, controller }
}

describe('FlashController', () => {
  it('renders off-screen: preparing does not touch what is on the page', () => {
    const { container, controller } = setup()
    controller.prepare('A')
    expect(container.textContent).toBe('old')
    expect(controller.ready).toBe(true)
  })

  it('swaps the prepared content in with a single DOM operation', async () => {
    const { container, controller, browser } = setup()
    const swap = vi.spyOn(container, 'replaceChildren')
    controller.prepare('A')
    const flashed = controller.flash()
    expect(swap).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('A') // visible as soon as the call returns
    browser.nextFrame()
    await flashed
    expect(swap).toHaveBeenCalledTimes(1)
  })

  it('fires onPainted once per flash, only after a frame has been painted', async () => {
    const { controller, painted, browser } = setup()
    controller.prepare('A')
    const p = controller.flash()
    expect(painted).toHaveLength(0) // not before the frame
    expect(browser.pending()).toBe(1)
    browser.nextFrame()
    const timing = await p
    expect(painted).toEqual([timing])
    browser.nextFrame() // further frames do nothing
    expect(painted).toHaveLength(1)
  })

  it('reports ordered, believable timings: swap, then frame, then paint', async () => {
    const { controller, browser } = setup()
    controller.prepare('A')
    const p = controller.flash()
    browser.advance(8)
    browser.nextFrame()
    const t = await p
    expect(t.swappedAt).toBeLessThan(t.frameStart)
    expect(t.frameStart).toBeLessThanOrEqual(t.paintedAt)
    expect(t.swapMs).toBeGreaterThanOrEqual(0)
    expect(t.prerenderMs).toBeGreaterThan(0)
    expect(t.late).toBe(false)
  })

  it('numbers flashes and fires once for each, even when flashed back to back', async () => {
    const { controller, painted, browser } = setup()
    controller.prepare('A')
    const a = controller.flash()
    controller.prepare('B')
    const b = controller.flash()
    browser.nextFrame()
    browser.nextFrame()
    const [ta, tb] = await Promise.all([a, b])
    expect([ta.id, tb.id]).toEqual([1, 2])
    expect(painted.map((t) => t.id)).toEqual([1, 2])
  })

  it('renders late (and says so) when nothing was prepared but an item is given', async () => {
    const { controller, container, browser } = setup()
    const p = controller.flash('Z')
    expect(container.textContent).toBe('Z')
    browser.nextFrame()
    const t = await p
    expect(t.late).toBe(true)
    expect(t.prerenderMs).toBe(0)
  })

  it('treats a different item than the prepared one as late', async () => {
    const { controller, container, browser } = setup()
    controller.prepare('A')
    const p = controller.flash('B')
    expect(container.textContent).toBe('B')
    browser.nextFrame()
    expect((await p).late).toBe(true)
  })

  it('refuses to flash with nothing prepared and no item', async () => {
    const { controller } = setup()
    await expect(controller.flash()).rejects.toThrow(/prepare\(\) first/)
  })

  it('uses the most recently prepared target, and uses it only once', async () => {
    const { controller, container, browser } = setup()
    controller.prepare('A')
    controller.prepare('B')
    const p = controller.flash()
    browser.nextFrame()
    await p
    expect(container.textContent).toBe('B')
    expect(controller.ready).toBe(false)
  })

  it('stops reporting after dispose, and rejects new flashes', async () => {
    const { controller, painted, browser } = setup()
    controller.prepare('A')
    void controller.flash()
    controller.dispose()
    browser.nextFrame()
    expect(painted).toHaveLength(0)
    await expect(controller.flash('X')).rejects.toThrow(/disposed/)
  })
})

describe('with the real grand staff renderer', () => {
  const key = keySignature(-3, 'major')
  const render = (into: HTMLElement, notes: string[]) =>
    void renderGrandStaff(into, { key, rh: notes.map(parsePitch), lh: [parsePitch('C3')] })

  it('does the expensive drawing off-screen, so the swap itself is tiny', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const browser = fakeBrowser()
    const controller = new FlashController<string[]>({
      container,
      render,
      now: () => performance.now(),
      requestFrame: browser.requestFrame,
      afterPaint: browser.afterPaint,
    })
    const timings: FlashTiming[] = []
    for (const notes of [
      ['E4', 'G4', 'C5'],
      ['F4', 'A4'],
      ['D4', 'F4', 'A4', 'C5'],
    ]) {
      const before = container.innerHTML
      controller.prepare(notes)
      expect(container.innerHTML).toBe(before) // preparing leaves the page untouched
      const p = controller.flash()
      browser.nextFrame()
      timings.push(await p)
    }
    expect(container.querySelectorAll('svg')).toHaveLength(1) // swapped, not stacked
    for (const t of timings) {
      expect(t.prerenderMs).toBeGreaterThan(t.swapMs) // the work happens before the flash
      expect(t.swapMs).toBeLessThan(16) // well inside one 60 Hz frame
    }
  })
})
