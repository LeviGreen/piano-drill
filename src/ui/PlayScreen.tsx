import { useState } from 'react'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import type { OnScreenKeyboardInput } from '../audio/inputs/OnScreenKeyboardInput'
import { createLevelGenerator } from '../levels/levelGenerator'
import { PianoKeyboard, type KeyMark } from '../notation/PianoKeyboard'
import { renderGrandStaff } from '../notation/renderGrandStaff'
import { DrillSession, type SessionSnapshot } from '../session/DrillSession'
import type { Storage } from '../storage'
import { keySignature } from '../theory/keys'
import { formatPitch } from '../theory/pitch'
import type { Target } from '../theory/target'
import { DrillScreenFrame } from './DrillScreenFrame'
import { PlaySettingsFields } from './PlaySettingsFields'
import { flashPresenter, useRepSession } from './useRepSession'
import { usePlaySettings } from './usePlaySettings'

/** A session is always this many targets. */
const DEFAULT_REPS = 20

/** The empty grand staff (both clefs, no notes) that is on screen before, between and after targets. */
const drawEmptyStaff = (el: HTMLElement | null) => {
  if (el) renderGrandStaff(el, { key: keySignature(0, 'major') })
}

const hands = (t: Target) => ({
  lh: t.parts.find((p) => p.hand === 'LH')?.pitches,
  rh: t.parts.find((p) => p.hand === 'RH')?.pitches,
})

export type PlayScreenProps = {
  /** For tests: where results are saved. Defaults to the app's database. */
  storage?: Storage
  /** For tests: stands in for the browser's MIDI request (null = a browser with no MIDI). */
  midiAccess?: RequestMidiAccess | null
  /** For tests only: a shorter session than the product's fixed 20 targets. */
  reps?: number
  /** For tests only: shorter waits than the product's fixed ones. */
  timing?: {
    getReadyMs?: { first: number; between: number }
    feedbackMs?: number
    revealMs?: number
  }
}

/**
 * Play mode (design §2, §9.3): a grand staff flashes a note, interval or chord; you play it. Every note you get
 * turns green on the staff and the keyboard, in any order, and the rep ends when all of them have been heard. The
 * on-screen piano stands in when no MIDI piano is connected.
 */
export function PlayScreen({ reps = DEFAULT_REPS, timing, storage, midiAccess }: PlayScreenProps) {
  const s = usePlaySettings()
  const { settings } = s
  const [input, setInput] = useState<OnScreenKeyboardInput | null>(null)

  const run = useRepSession<Target, SessionSnapshot, DrillSession>({
    midiAccess,
    drawEmpty: drawEmptyStaff,
    create: ({ drill, stage }) => {
      setInput(drill.screen)
      return new DrillSession({
        settings,
        generator: createLevelGenerator(settings, Math.floor(Math.random() * 1e6)),
        input: drill.input,
        presenter: flashPresenter<Target>({
          container: stage,
          render: (into, t) => renderGrandStaff(into, { key: t.key, ...hands(t) }),
          reveal: (t) => renderGrandStaff(stage, { key: t.key, ...hands(t), showNames: true }),
          clear: () => drawEmptyStaff(stage),
        }),
        totalReps: reps,
        ...timing,
      })
    },
    // Each note heard so far gets a green halo on the staff.
    onSnapshot: (snapshot, stage) => {
      const t = snapshot.target
      // That includes the moment the last note completes the target, when the session has already moved on to SUCCESS.
      const showing =
        snapshot.state === 'FLASHED' ||
        snapshot.state === 'SUCCESS' ||
        (snapshot.state === 'INTERSTITIAL' && snapshot.lastOutcome?.startsWith('correct'))
      if (!t || !showing || snapshot.heard.length === 0 || !stage) return
      const { lh, rh } = hands(t)
      const states = (pitches?: { midi: number }[]) =>
        pitches?.map((p) => (snapshot.heard.includes(p.midi) ? ('heard' as const) : undefined))
      renderGrandStaff(stage, { key: t.key, lh, rh, lhStates: states(lh), rhStates: states(rh) })
    },
  })
  const { snap, state } = run

  // ----- what the screen says -----
  const revealed =
    state === 'INTERSTITIAL' && (snap?.lastOutcome === 'timeout' || snap?.lastOutcome === 'skipped')
  const marks = new Map<number, KeyMark>()
  if (snap) {
    for (const m of snap.heard) marks.set(m, 'heard')
    for (const e of snap.errors) for (const m of e.notes) if (!marks.has(m)) marks.set(m, 'wrong')
    if (revealed) for (const m of snap.expected) if (!marks.has(m)) marks.set(m, 'target')
  }
  const labels = new Map(
    snap?.target?.parts.flatMap((p) => p.pitches).map((p) => [p.midi, formatPitch(p)]) ?? [],
  )
  const message = revealed
    ? `${snap?.lastOutcome === 'timeout' ? "Time's up." : 'Skipped.'} Here is the answer.`
    : ''

  return (
    <DrillScreenFrame
      title="Sight-Read"
      className="play-screen"
      run={run}
      itemWord="target"
      total={reps}
      playingText="Play it!"
      message={message}
      score={{
        mode: 'play',
        levelId: s.levelId,
        goalSeconds: settings.goal?.medianSeconds,
        timeoutSeconds: settings.timeoutSeconds,
        storage,
      }}
      settingsTitle="Sight-Read settings"
      settings={<PlaySettingsFields s={s} piano={run.piano} running={run.running} />}
    >
      <p className="play-notes">
        {state === 'FLASHED' && snap ? `${snap.heard.length} / ${snap.expected.length} notes` : ''}
      </p>

      <PianoKeyboard
        marks={marks}
        labels={labels}
        showNames={revealed}
        onKeyPress={state === 'FLASHED' && input ? (m) => input.press(m) : undefined}
        onKeyRelease={input ? (m) => input.release(m) : undefined}
        label="On-screen piano"
      />
    </DrillScreenFrame>
  )
}
