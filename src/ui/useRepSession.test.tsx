import { act, cleanup, render, screen } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseSettings } from '../levels/settings'
import { DrillSession, type SessionSnapshot } from '../session/DrillSession'
import type { Presenter } from '../session/types'
import { FakeClock, flush } from '../test-utils/fakeClock'
import { keySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import type { Target } from '../theory/target'
import { useRepSession, type RepRun } from './useRepSession'

afterEach(cleanup)

const target = (id: string): Target => ({
  id,
  key: keySignature(0, 'major'),
  parts: [{ hand: 'RH', clef: 'treble', pitches: [parsePitch('C4')] }],
  content: { type: 'note' },
})

/** Mount the hook inside a tiny component, with a session on a fake clock, and hand back what it returns. */
function setup() {
  const clock = new FakeClock()
  const drawEmpty = vi.fn()
  const created = vi.fn()
  const presenter: Presenter = {
    prepare: () => {},
    flash: () => new Promise((resolve) => clock.setTimeout(() => resolve(clock.now()), 3)),
    reveal: () => {},
    clear: () => {},
  }
  const run: { current: RepRun & { session: RefObject<DrillSession | null> } } = {
    current: null as never,
  }
  let n = 0
  function Probe() {
    const r = useRepSession<Target, SessionSnapshot, DrillSession>({
      drawEmpty,
      create: (ctx) => {
        created(ctx)
        const parsed = parseSettings({ timeoutSeconds: null })
        if (!parsed.ok) throw new Error('settings')
        return new DrillSession({
          settings: parsed.settings,
          generator: { next: () => target(`t${++n}`) },
          input: ctx.drill.input,
          presenter,
          clock,
          getReadyMs: { first: 0, between: 0 },
          feedbackMs: 10,
          revealMs: 10,
          totalReps: 2,
        })
      },
    })
    run.current = r
    return (
      <div ref={r.stage} data-testid="stage">
        {r.state}
      </div>
    )
  }
  const view = render(<Probe />)
  return { clock, drawEmpty, created, run, view }
}

describe('useRepSession', () => {
  it('draws the empty staff on mount and starts idle', () => {
    const t = setup()
    expect(t.drawEmpty).toHaveBeenCalledWith(screen.getByTestId('stage'))
    expect(t.run.current.state).toBe('IDLE')
    expect(t.run.current.running).toBe(false)
    expect(t.run.current.results).toEqual([])
  })

  it('start opens the input, builds the session on the stage, and follows it to the target', async () => {
    const t = setup()
    await act(async () => {
      t.run.current.start()
      await flush()
    })
    expect(t.created).toHaveBeenCalledTimes(1)
    const ctx = t.created.mock.calls[0][0]
    expect(ctx.stage).toBe(screen.getByTestId('stage'))
    expect(ctx.drill.screen).toBeDefined() // the on-screen piano is always there
    expect(t.run.current.state).toBe('READY')
    await act(async () => {
      await t.clock.advance(10)
    })
    expect(t.run.current.state).toBe('FLASHED')
    expect(t.run.current.running).toBe(true)
  })

  it('skip records the result; pause and resume go there and back; end stops', async () => {
    const t = setup()
    await act(async () => {
      t.run.current.start()
      await flush()
      await t.clock.advance(10)
    })
    await act(async () => t.run.current.skip())
    expect(t.run.current.results).toHaveLength(1)
    expect(t.run.current.results[0].outcome).toBe('skipped')

    await act(async () => t.run.current.pause())
    expect(t.run.current.state).toBe('PAUSED')
    await act(async () => t.run.current.resume())
    expect(t.run.current.state).not.toBe('PAUSED')

    await act(async () => t.run.current.end())
    expect(t.run.current.state).toBe('ENDED')
    expect(t.run.current.running).toBe(false)
  })

  it('a new start clears the old results and the dismissed results window', async () => {
    const t = setup()
    await act(async () => {
      t.run.current.start()
      await flush()
      await t.clock.advance(10)
    })
    await act(async () => t.run.current.skip())
    await act(async () => t.run.current.end())
    await act(async () => t.run.current.dismiss())
    expect(t.run.current.dismissed).toBe(true)
    await act(async () => {
      t.run.current.start()
      await flush()
    })
    expect(t.run.current.dismissed).toBe(false)
    expect(t.run.current.results).toEqual([])
    expect(t.created).toHaveBeenCalledTimes(2)
  })

  it('ends the session when the screen goes away', async () => {
    const t = setup()
    await act(async () => {
      t.run.current.start()
      await flush()
    })
    const session = t.run.current.session.current!
    t.view.unmount()
    expect(session.snapshot.state).toBe('ENDED')
  })
})
