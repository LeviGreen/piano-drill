import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { createLevelGenerator, type LevelGenerator } from '../levels/levelGenerator'
import { levelById } from '../levels/presets'
import { FlashController, type FlashTiming } from '../notation/flash'
import { renderGrandStaff } from '../notation/renderGrandStaff'
import { keySignature } from '../theory/keys'
import type { Target } from '../theory/target'

const ms = (x: number) => `${x.toFixed(2)} ms`
const FRAME_MS = 1000 / 60
const pct = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]

/** Diagnostic screen for PD-204: flash targets, read the timing, and try a reaction test. */
export function FlashTestScreen() {
  const stage = useRef<HTMLDivElement>(null)
  const controller = useRef<FlashController<Target> | null>(null)
  const generator = useRef<LevelGenerator | null>(null)
  const state = useRef({ flashes: 0, painted: 0, t0: null as number | null })
  const [last, setLast] = useState<FlashTiming | null>(null)
  const [counts, setCounts] = useState({ flashes: 0, painted: 0 })
  const [reaction, setReaction] = useState<string>('')
  const [bench, setBench] = useState<string>('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!stage.current) return
    renderGrandStaff(stage.current, { key: keySignature(0, 'major') }) // an empty staff until the first flash
    generator.current = createLevelGenerator(levelById(8).settings, 7)
    const c = new FlashController<Target>({
      container: stage.current,
      render: (into, t) =>
        renderGrandStaff(into, { key: t.key, lh: t.parts[0].pitches, rh: t.parts[1]?.pitches }),
      onPainted: (t) => {
        state.current.painted++
        state.current.t0 = t.paintedAt
        setLast(t)
        setCounts({ flashes: state.current.flashes, painted: state.current.painted })
      },
    })
    controller.current = c
    c.prepare(generator.current.next())
    return () => c.dispose()
  }, [])

  const flashOnce = () => {
    const c = controller.current
    if (!c || !generator.current) return Promise.resolve(null)
    state.current.flashes++
    state.current.t0 = null
    setReaction('')
    const p = c.flash()
    c.prepare(generator.current.next()) // get the next one ready while this one is on screen
    return p
  }

  const benchmark = async () => {
    setRunning(true)
    const timings: FlashTiming[] = []
    for (let i = 0; i < 50; i++) {
      const t = await flashOnce()
      if (t) timings.push(t)
      await new Promise((r) => setTimeout(r, 30))
    }
    const swaps = timings.map((t) => t.swapMs)
    const pre = timings.map((t) => t.prerenderMs)
    const paint = timings.map((t) => t.paintedAt - t.swappedAt)
    const slow = swaps.filter((s) => s > FRAME_MS).length
    setBench(
      [
        `50 flashes`,
        `swap:      median ${ms(pct(swaps, 0.5))}, 95th ${ms(pct(swaps, 0.95))}, worst ${ms(Math.max(...swaps))}`,
        `prerender: median ${ms(pct(pre, 0.5))}, 95th ${ms(pct(pre, 0.95))}, worst ${ms(Math.max(...pre))}  (off-screen, before the flash)`,
        `swap to painted: median ${ms(pct(paint, 0.5))}, 95th ${ms(pct(paint, 0.95))}`,
        `swaps longer than one 60 Hz frame (${ms(FRAME_MS)}): ${slow} of ${swaps.length}`,
        `late renders (nothing prepared): ${timings.filter((t) => t.late).length}`,
      ].join('\n'),
    )
    setRunning(false)
  }

  // Reaction test: press any key as soon as a new target appears; time runs from the painted moment (t0).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { t0 } = state.current
      if (t0 === null || e.repeat) return
      setReaction(`${(performance.now() - t0).toFixed(0)} ms from painted to key press`)
      state.current.t0 = null
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Flash test</h1>
      <p className="placeholder">
        Checks the flash timing (PD-204). Each target is drawn off-screen first, then swapped in at
        once, and the screen tells you when it was actually painted. That moment is the drill
        timer's start.
      </p>

      <p>
        <button type="button" onClick={() => void flashOnce()} disabled={running}>
          Flash next target
        </button>{' '}
        <button type="button" onClick={() => void benchmark()} disabled={running}>
          Run 50 flashes
        </button>
      </p>
      <div ref={stage} className="staff" />

      <h2>Last flash</h2>
      <pre className="mic-readout">
        {last
          ? [
              `prerender (off-screen): ${ms(last.prerenderMs)}${last.late ? '  (LATE: nothing was prepared)' : ''}`,
              `swap (the DOM change): ${ms(last.swapMs)}  ${last.swapMs <= FRAME_MS ? 'within one frame' : 'LONGER than one frame'}`,
              `swap to frame start:   ${ms(last.frameStart - last.swappedAt)}`,
              `swap to painted (t0):  ${ms(last.paintedAt - last.swappedAt)}`,
              `flashes: ${counts.flashes}   painted callbacks: ${counts.painted}   ${counts.flashes === counts.painted ? '(one per flash)' : '(MISMATCH)'}`,
            ].join('\n')
          : 'Press "Flash next target".'}
      </pre>

      <h2>Reaction test</h2>
      <p className="placeholder">
        Flash a target, then press any key the instant you see it. A person typically takes 150 to
        300 ms; if the number is far below 100 ms, t0 is too early.
      </p>
      <pre className="mic-readout">{reaction || '—'}</pre>

      <h2>Benchmark</h2>
      <pre className="mic-readout">{bench || 'Press "Run 50 flashes".'}</pre>
    </>
  )
}
