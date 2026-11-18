import { useEffect, useRef, useState } from 'react'
import type { RequestMidiAccess } from '../audio/inputs/MidiInput'
import type { OnScreenKeyboardInput } from '../audio/inputs/OnScreenKeyboardInput'
import { createLevelGenerator } from '../levels/levelGenerator'
import { PRESET_LEVELS } from '../levels/presets'
import {
  mergeSettings,
  parseKeyName,
  parseSettings,
  type DifficultySettings,
} from '../levels/settings'
import { FlashController } from '../notation/flash'
import { PianoKeyboard, type KeyMark } from '../notation/PianoKeyboard'
import { renderGrandStaff } from '../notation/renderGrandStaff'
import { DrillSession, type SessionSnapshot } from '../session/DrillSession'
import { summarize } from '../session/summary'
import type { Storage } from '../storage'
import type { Presenter, RepResult } from '../session/types'
import { keyName, keySignature } from '../theory/keys'
import { formatPitch } from '../theory/pitch'
import type { Target } from '../theory/target'
import { DifficultyFields } from './DifficultyFields'
import { InputChoiceField } from './InputChoiceField'
import { levelLabel } from './levelLabel'
import { ScoreSummary } from './ScoreSummary'
import { SettingsDrawer } from './SettingsDrawer'
import { useCountdown } from './useCountdown'
import { usePianoInput } from './usePianoInput'
import { useRemainingSeconds } from './useRemainingSeconds'

/** A session is always this many targets. */
const DEFAULT_REPS = 20
const STORAGE_KEY = 'piano-drill.play-settings'
/** The key signature last picked for "One key signature", kept so switching away and back remembers it. */
const ONE_KEY_STORAGE = 'piano-drill.play-one-key'

/** The sharps/flats of the one key signature the settings are set to, or null when they draw from several keys. */
const oneKeySignature = (s: DifficultySettings): number | null => {
  const name = s.keys.explicit?.[0]
  return name === undefined ? null : (parseKeyName(name)?.accidentals ?? null)
}

const signatureLabel = (n: number): string => {
  const names = `${keyName(keySignature(n, 'major'))} / ${keyName(keySignature(n, 'minor'))}`
  const count =
    n === 0
      ? 'no sharps or flats'
      : `${Math.abs(n)} ${n > 0 ? 'sharp' : 'flat'}${Math.abs(n) > 1 ? 's' : ''}`
  return `${names} (${count})`
}
const SIGNATURES = Array.from({ length: 15 }, (_, i) => i - 7)

/** The empty grand staff (both clefs, no notes) that is on screen before, between and after targets. */
const drawEmptyStaff = (el: HTMLElement | null) => {
  if (el) renderGrandStaff(el, { key: keySignature(0, 'major') })
}

const hands = (t: Target) => ({
  lh: t.parts.find((p) => p.hand === 'LH')?.pitches,
  rh: t.parts.find((p) => p.hand === 'RH')?.pitches,
})

type Loaded = { settings: DifficultySettings; levelId: number | 'custom' }

/** The settings and level picked last time, or level 1. */
function loadSettings(): Loaded {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as { levelId?: unknown; settings?: unknown }
      const parsed = parseSettings(saved.settings)
      if (parsed.ok) {
        const known = PRESET_LEVELS.some((l) => l.id === saved.levelId)
        return { settings: parsed.settings, levelId: known ? (saved.levelId as number) : 'custom' }
      }
    }
  } catch {
    // Storage unavailable or corrupt: start on level 1.
  }
  return { settings: PRESET_LEVELS[0].settings, levelId: PRESET_LEVELS[0].id }
}

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
  const [initial] = useState(loadSettings)
  const [settings, setSettings] = useState<DifficultySettings>(initial.settings)
  const [levelId, setLevelId] = useState<number | 'custom'>(initial.levelId)
  const level = PRESET_LEVELS.find((l) => l.id === levelId)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lastSignature, setLastSignature] = useState<number>(() => {
    const now = oneKeySignature(initial.settings)
    if (now !== null) return now
    try {
      const n = Number(localStorage.getItem(ONE_KEY_STORAGE))
      return Number.isInteger(n) && n >= -7 && n <= 7 ? n : 0
    } catch {
      return 0
    }
  })
  const signature = oneKeySignature(settings)
  const [dismissed, setDismissed] = useState(false)
  const stage = useRef<HTMLDivElement>(null)
  const session = useRef<DrillSession | null>(null)
  const [input, setInput] = useState<OnScreenKeyboardInput | null>(null)
  const [snap, setSnap] = useState<SessionSnapshot | null>(null)
  const [results, setResults] = useState<RepResult[]>([])
  const count = useCountdown(snap?.ready ?? null)
  const piano = usePianoInput({
    requestAccess: midiAccess,
    onLost: () => session.current?.pause(), // the piano went away: stop, and say so
  })

  useEffect(() => {
    drawEmptyStaff(stage.current)
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
    settings.timeoutSeconds,
  )

  const start = async () => {
    session.current?.end()
    drawEmptyStaff(stage.current)
    setResults([])
    setSnap(null)
    setDismissed(false)
    const drill = await piano.open() // a missing MIDI piano is reported here, before anything starts
    if (!drill) return
    setInput(drill.screen)
    const flash = new FlashController<Target>({
      container: stage.current!,
      render: (into, t) => renderGrandStaff(into, { key: t.key, ...hands(t) }),
    })
    const presenter: Presenter = {
      prepare: (t) => flash.prepare(t),
      flash: async (t) => (await flash.flash(t)).paintedAt,
      reveal: (t) => renderGrandStaff(stage.current!, { key: t.key, ...hands(t), showNames: true }),
      clear: () => drawEmptyStaff(stage.current),
    }
    const s = new DrillSession({
      settings,
      generator: createLevelGenerator(settings, Math.floor(Math.random() * 1e6)),
      input: drill.input,
      presenter,
      totalReps: reps,
      ...timing,
    })
    session.current = s
    s.subscribe((snapshot) => {
      setSnap(snapshot)
      setResults([...s.results])
      // Each note heard so far gets a green halo on the staff.
      const t = snapshot.target
      // That includes the moment the last note completes the target, when the session has already moved on to SUCCESS.
      const showing =
        snapshot.state === 'FLASHED' ||
        snapshot.state === 'SUCCESS' ||
        (snapshot.state === 'INTERSTITIAL' && snapshot.lastOutcome?.startsWith('correct'))
      if (t && showing && snapshot.heard.length > 0 && stage.current) {
        const { lh, rh } = hands(t)
        const states = (pitches?: { midi: number }[]) =>
          pitches?.map((p) => (snapshot.heard.includes(p.midi) ? ('heard' as const) : undefined))
        renderGrandStaff(stage.current, {
          key: t.key,
          lh,
          rh,
          lhStates: states(lh),
          rhStates: states(rh),
        })
      }
    })
    await s.start()
  }

  const change = (next: DifficultySettings, id: number | 'custom') => {
    setSettings(next)
    setLevelId(id)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ levelId: id, settings: next }))
    } catch {
      // Not saved; the settings still apply for this visit.
    }
  }
  /** Change some options by hand: the settings stay valid and the level picker goes to "Custom". */
  const edit = (patch: Record<string, unknown>) => {
    const r = mergeSettings(settings, patch)
    if (r.ok) change({ ...r.settings, name: 'Custom' }, 'custom')
  }
  /** One key signature: the major key and its relative minor, so notes, intervals and chords come from both. */
  const pickSignature = (n: number) => {
    setLastSignature(n)
    try {
      localStorage.setItem(ONE_KEY_STORAGE, String(n))
    } catch {
      // Not remembered across visits.
    }
    edit({
      keys: {
        explicit: [keyName(keySignature(n, 'major')), keyName(keySignature(n, 'minor'))],
      },
    })
  }
  const pickKeyChoice = (value: string) => {
    if (value === 'one') return pickSignature(lastSignature)
    const { explicit: _gone, ...keys } = settings.keys
    const r = parseSettings({ ...settings, name: 'Custom', keys })
    if (r.ok) change(r.settings, 'custom')
  }
  const pickLevel = (value: string) => {
    if (value === 'custom') return setLevelId('custom')
    const picked = PRESET_LEVELS.find((l) => l.id === Number(value))
    if (picked) change(picked.settings, picked.id)
  }

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
  const status =
    state === 'IDLE'
      ? 'Press Start.'
      : state === 'READY'
        ? 'Get ready…'
        : state === 'PAUSED'
          ? 'Paused. The target on screen was discarded.'
          : state === 'ENDED'
            ? snap?.completedReps === reps
              ? 'Session complete.'
              : 'Session ended.'
            : 'Play it!'
  const message = revealed
    ? `${snap?.lastOutcome === 'timeout' ? "Time's up." : 'Skipped.'} Here is the answer.`
    : ''
  const summary = state === 'ENDED' && results.length > 0 ? summarize(results) : null

  return (
    <div className="keyid-screen play-screen">
      <h1>Sight-Read</h1>
      <div className="keyid-bar">
        <button type="button" onClick={() => void start()} disabled={running || piano.starting}>
          Start
        </button>
        {state === 'PAUSED' ? (
          <button
            type="button"
            disabled={piano.lost}
            onClick={() => {
              piano.acknowledge()
              session.current?.resume()
            }}
          >
            Resume
          </button>
        ) : (
          <button type="button" onClick={() => session.current?.pause()} disabled={!running}>
            Pause
          </button>
        )}
        <button
          type="button"
          onClick={() => session.current?.skip()}
          disabled={state !== 'FLASHED'}
        >
          Skip
        </button>
        <button type="button" onClick={() => session.current?.end()} disabled={!running}>
          End
        </button>
        <button type="button" className="seg" onClick={() => setDrawerOpen(true)}>
          Settings
        </button>
      </div>

      <p className="keyid-status" role="status">
        <strong>{status}</strong>
        {running && snap && state !== 'PAUSED' && (
          <>
            {' '}
            Target {Math.min(snap.repNumber, reps)} of {reps}
          </>
        )}
      </p>

      <p className="keyid-clock">{remaining ?? ''}</p>

      <div className="stage">
        <div ref={stage} className="staff" />
        {count !== null && (
          <div className="countdown" role="timer" aria-label="Seconds until the first target">
            {count > 0 ? count : '…'}
          </div>
        )}
      </div>

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

      <div className={`result-slot${piano.notice ? ' midi-problem' : ''}`} role="status">
        {piano.notice ?? message}
      </div>

      {summary && !dismissed && (
        <ScoreSummary
          mode="play"
          levelId={levelId}
          levelName={levelLabel(levelId)}
          goalSeconds={settings.goal?.medianSeconds}
          timeoutSeconds={settings.timeoutSeconds}
          plannedReps={reps}
          results={results}
          storage={storage}
          onClose={() => setDismissed(true)}
          onAgain={() => void start()}
        ></ScoreSummary>
      )}

      <SettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Sight-Read settings"
        centered
      >
        <fieldset disabled={running}>
          <legend>Keys</legend>
          <div className="segmented" role="radiogroup" aria-label="Keys">
            {(
              [
                ['several', 'Several keys'],
                ['one', 'One key signature'],
              ] as const
            ).map(([value, label]) => {
              const checked = (signature === null ? 'several' : 'one') === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={running}
                  onClick={() => !checked && pickKeyChoice(value)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>
        {/* Both stay in the layout (one over the other, the unused one invisible), so the modal never changes size. */}
        <div className="overlay">
          <div className={signature === null ? '' : 'unused'} aria-hidden={signature !== null}>
            <label>
              Level
              <select
                value={levelId}
                onChange={(e) => pickLevel(e.target.value)}
                disabled={running || signature !== null}
              >
                <option value="custom">Custom</option>
                {PRESET_LEVELS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            {level && <small className="placeholder">{level.description}</small>}
          </div>
          <div className={signature === null ? 'unused' : ''} aria-hidden={signature === null}>
            <label>
              Key signature
              <select
                value={signature ?? lastSignature}
                onChange={(e) => pickSignature(Number(e.target.value))}
                disabled={running || signature === null}
              >
                {SIGNATURES.map((n) => (
                  <option key={n} value={n}>
                    {signatureLabel(n)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <InputChoiceField value={piano.choice} onChange={piano.setChoice} disabled={running} />
        <DifficultyFields
          settings={settings}
          onEdit={edit}
          disabled={running}
          showKeys={false}
          showAccidentals={signature === null}
          showTimeLimit
        />
        {running && <small className="placeholder">Settings are locked during a session.</small>}
      </SettingsDrawer>
    </div>
  )
}
