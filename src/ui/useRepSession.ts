import { useEffect, useRef, useState, type RefObject } from 'react'
import type { DrillInput } from '../audio/inputs/drillInput'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import { FlashController } from '../notation/flash'
import type { RepSession } from '../session/RepSession'
import type { BaseSnapshot, Presenter, RepResult, SessionState } from '../session/types'
import { useCountdown } from './useCountdown'
import { usePianoInput } from './usePianoInput'
import { useRemainingSeconds } from './useRemainingSeconds'

/**
 * A presenter that draws each item with a `FlashController`, so the flash is a single swap and its time is exact. A mode
 * says how to draw an item (`render`), how to show its answer (`reveal`) and how to empty the staff (`clear`).
 */
export function flashPresenter<Item>(opts: {
  container: HTMLElement
  render: (into: HTMLElement, item: Item) => void
  reveal: (item: Item) => void
  clear: () => void
}): Presenter<Item> {
  const flash = new FlashController<Item>({ container: opts.container, render: opts.render })
  return {
    prepare: (item) => flash.prepare(item),
    flash: async (item) => (await flash.flash(item)).paintedAt,
    reveal: opts.reveal,
    clear: opts.clear,
  }
}

/** What a screen shows and does while a session runs; the same for every mode. */
export type RepRun = {
  /** Put this on the element the staff is drawn into. */
  stage: RefObject<HTMLDivElement | null>
  snap: BaseSnapshot<unknown> | null
  results: RepResult[]
  state: SessionState
  /** A session is under way (started, not yet ended). */
  running: boolean
  /** The 4, 3, 2, 1 before the first item, or null. */
  count: number | null
  /** Seconds left, shown only for the last few; null otherwise. */
  remaining: number | null
  piano: ReturnType<typeof usePianoInput>
  /** The results window was closed (until the next session). */
  dismissed: boolean
  dismiss: () => void
  start: () => void
  pause: () => void
  resume: () => void
  skip: () => void
  end: () => void
}

export type UseRepSessionOptions<Snap, S> = {
  /** For tests: stands in for the browser's MIDI request (null = a browser with no MIDI). */
  midiAccess?: RequestMidiAccess | null
  /** Draw the empty staff the screen shows before, between and after items. */
  drawEmpty: (stage: HTMLElement | null) => void
  /** Make the session. The screen decides its generator, presenter and settings. */
  create: (ctx: { drill: DrillInput; stage: HTMLElement }) => S
  /** Called on every snapshot, after the screen state is updated (for per-note marks on the staff). */
  onSnapshot?: (snapshot: Snap, stage: HTMLElement | null) => void
}

/**
 * Everything the Sight-Read and Key Signatures screens share about running a session: opening the chosen input,
 * creating and subscribing to the session, keeping its snapshot and results in state, and the controls. Returns the
 * session ref too, for what only one mode does (answering, switching how it is answered).
 */
export function useRepSession<
  Item,
  Snap extends BaseSnapshot<Item>,
  S extends RepSession<Item, Snap>,
>(
  opts: UseRepSessionOptions<Snap, S>,
): Omit<RepRun, 'snap'> & {
  snap: Snap | null
  session: RefObject<S | null>
} {
  const stage = useRef<HTMLDivElement>(null)
  const session = useRef<S | null>(null)
  const [snap, setSnap] = useState<Snap | null>(null)
  const [results, setResults] = useState<RepResult[]>([])
  const [dismissed, setDismissed] = useState(false)
  const piano = usePianoInput({
    requestAccess: opts.midiAccess,
    onLost: () => session.current?.pause(), // the piano went away: stop, and say so
  })
  const count = useCountdown(snap?.ready ?? null)

  // The latest options, so the callbacks below always use the current settings without being re-made.
  const latest = useRef(opts)
  latest.current = opts

  useEffect(() => {
    latest.current.drawEmpty(stage.current)
    return () => session.current?.end()
  }, [])

  const state = snap?.state ?? 'IDLE'
  const running = state !== 'IDLE' && state !== 'ENDED'
  useEffect(() => {
    if (state === 'ENDED') piano.release()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  const remaining = useRemainingSeconds(
    state === 'FLASHED',
    snap?.t0 ?? null,
    snap?.limitSeconds ?? null,
  )

  const start = async () => {
    const { drawEmpty, create, onSnapshot } = latest.current
    session.current?.end()
    drawEmpty(stage.current)
    setResults([])
    setSnap(null)
    setDismissed(false)
    const drill = await piano.open() // a missing MIDI piano is reported here, before anything starts
    if (!drill) return
    const s = create({ drill, stage: stage.current! })
    session.current = s
    s.subscribe((snapshot) => {
      setSnap(snapshot)
      setResults([...s.results])
      onSnapshot?.(snapshot, stage.current)
    })
    await s.start()
  }

  return {
    stage,
    snap,
    results,
    state,
    running,
    count,
    remaining,
    piano,
    dismissed,
    dismiss: () => setDismissed(true),
    start: () => void start(),
    pause: () => session.current?.pause(),
    resume: () => {
      piano.acknowledge()
      session.current?.resume()
    },
    skip: () => session.current?.skip(),
    end: () => session.current?.end(),
    session,
  }
}
