import { useState } from 'react'
import { Link } from 'react-router'
import { createLevelGenerator } from '../levels/levelGenerator'
import { PRESET_LEVELS } from '../levels/presets'
import {
  mergeSettings,
  parseSettings,
  type DifficultySettings,
  type HandMode,
} from '../levels/settings'
import { GrandStaff } from '../notation/GrandStaff'
import { PianoKeyboard, type KeyMark } from '../notation/PianoKeyboard'
import { keyName, type Mode } from '../theory/keys'
import { formatPitch } from '../theory/pitch'
import type { Target } from '../theory/target'
import { HandsPicture, NotesPicture } from './HandPictures'
import { ToggleTile } from './ToggleTile'

type Mark = 'almost' | 'heard' | 'wrong'

const NOTE_COUNTS = [
  { value: 1, label: '1 note', note: 'single note' },
  { value: 2, label: '2 notes', note: 'interval' },
  { value: 3, label: '3 notes', note: 'triad' },
  { value: 4, label: '4 notes', note: 'seventh chord' },
] as const

/** Toggle a value in a list, but never remove the last one. */
function toggle<T>(list: T[], value: T): T[] {
  if (!list.includes(value)) return [...list, value]
  return list.length > 1 ? list.filter((x) => x !== value) : list
}

const ORDINAL = ['root position', '1st inversion', '2nd inversion', '3rd inversion']
const names = (pitches: Target['parts'][number]['pitches']) => pitches.map(formatPitch).join(' ')

function describe(t: Target): string {
  if (t.parts.length === 2) {
    const [lh, rh] = t.parts
    return `${keyName(t.key)}: ${lh.label}   LH [${names(lh.pitches)}]  RH [${names(rh.pitches)}]`
  }
  const part = t.parts[0]
  const what =
    t.content.type === 'note'
      ? 'note'
      : t.content.type === 'interval'
        ? `interval ${t.content.quality}`
        : `${part.label} ${t.content.type}, ${ORDINAL[t.content.inversion ?? 0]}`
  return `${keyName(t.key)}: ${what}  [${names(part.pitches)}]`
}

/** Shows generated targets for one set of settings. Remounted (via key) when the settings change. */
function Preview({
  settings,
  seed,
  showNames,
}: {
  settings: DifficultySettings
  seed: number
  showNames: boolean
}) {
  const [generator] = useState(() => createLevelGenerator(settings, seed))
  const [history, setHistory] = useState<Target[]>(() => [generator.next()])
  // Pretend-feedback for trying out the display: click a key to cycle a target note through
  // missing -> almost -> heard, or to mark a non-target key as a wrong note.
  const [marks, setMarks] = useState<Map<number, Mark>>(new Map())
  const current = history[0]

  const lhPart = current.parts.find((p) => p.hand === 'LH')
  const rhPart = current.parts.find((p) => p.hand === 'RH')
  const targetPitches = current.parts.flatMap((p) => p.pitches)
  const targetMidis = new Set(targetPitches.map((p) => p.midi))
  const stateOf = (midi: number): 'almost' | 'heard' | undefined => {
    const m = marks.get(midi)
    return m === 'heard' || m === 'almost' ? m : undefined
  }
  const heard = targetPitches.filter((p) => marks.get(p.midi) === 'heard').length

  const keyMarks = new Map<number, KeyMark>()
  for (const p of targetPitches) keyMarks.set(p.midi, stateOf(p.midi) ?? 'target')
  for (const [midi, m] of marks) if (m === 'wrong') keyMarks.set(midi, 'wrong')
  const labels = new Map(targetPitches.map((p) => [p.midi, formatPitch(p)]))

  const onKey = (midi: number) =>
    setMarks((prev) => {
      const next = new Map(prev)
      const now = prev.get(midi)
      if (targetMidis.has(midi)) {
        const after = now === undefined ? 'almost' : now === 'almost' ? 'heard' : undefined
        if (after) next.set(midi, after)
        else next.delete(midi)
      } else if (now === 'wrong') next.delete(midi)
      else next.set(midi, 'wrong')
      return next
    })

  const nextTarget = () => {
    setHistory((h) => [generator.next(), ...h].slice(0, 8))
    setMarks(new Map())
  }

  return (
    <>
      <p>
        <button type="button" onClick={nextTarget}>
          Next target
        </button>
      </p>
      <GrandStaff
        keySignature={current.key}
        lh={lhPart?.pitches}
        rh={rhPart?.pitches}
        showNames={showNames}
        lhStates={lhPart?.pitches.map((p) => stateOf(p.midi))}
        rhStates={rhPart?.pitches.map((p) => stateOf(p.midi))}
        label={describe(current)}
      />
      <PianoKeyboard marks={keyMarks} labels={labels} showNames={showNames} onKeyClick={onKey} />
      <p className="placeholder">
        Try the feedback: click a key to mark a target note almost heard, then heard, then clear;
        click any other key to mark a wrong note.
      </p>
      <p>
        <strong>{describe(current)}</strong>
        <br />
        {heard} / {targetPitches.length} notes heard
      </p>
      <h2>Recent</h2>
      <ol className="recent">
        {history.slice(1).map((t) => (
          <li key={t.id}>{describe(t)}</li>
        ))}
      </ol>
    </>
  )
}

const START: DifficultySettings = (() => {
  const r = parseSettings({
    name: 'Custom',
    hands: ['RH'],
    notesPerHand: [3],
    keys: { maxAccidentals: 2, modes: 'both' },
    inversions: true,
    chromaticNotes: 'occasional',
  })
  if (!r.ok) throw new Error(r.errors.join('; '))
  return r.settings
})()

/** Dev screen for PD-105/106/108/202/203/205: pick a level or build settings, and see the targets drawn. */
export function GeneratorPreviewScreen() {
  const [settings, setSettings] = useState<DifficultySettings>(START)
  const [levelId, setLevelId] = useState<number | 'custom'>('custom')
  const [showNames, setShowNames] = useState(false)
  const [seed, setSeed] = useState(1)

  /** Change some settings by hand; the settings stay valid, and the level picker goes back to "Custom". */
  const edit = (patch: Record<string, unknown>) => {
    const r = mergeSettings(settings, patch)
    if (r.ok) {
      setSettings({ ...r.settings, name: 'Custom' })
      setLevelId('custom')
    }
  }
  const pickLevel = (value: string) => {
    if (value === 'custom') return setLevelId('custom')
    const level = PRESET_LEVELS.find((l) => l.id === Number(value))
    if (level) {
      setSettings(level.settings)
      setLevelId(level.id)
    }
  }

  const handTile = (mode: HandMode, label: string, pic: 'left' | 'right' | 'both') => (
    <ToggleTile
      label={label}
      pressed={settings.hands.includes(mode)}
      onToggle={() => edit({ hands: toggle(settings.hands, mode) })}
    >
      <HandsPicture hands={pic} />
    </ToggleTile>
  )
  const level = PRESET_LEVELS.find((l) => l.id === levelId)

  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Generator preview</h1>
      <p className="placeholder">
        Targets from the level settings (PD-108) and generators (PD-105, PD-106) drawn on the grand
        staff, within G2 to F5. Pick a preset level, or build your own.
      </p>

      <div className="recorder-form">
        <label>
          Level
          <select value={levelId} onChange={(e) => pickLevel(e.target.value)}>
            <option value="custom">Custom</option>
            {PRESET_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        {level && <small className="placeholder">{level.description}</small>}

        <fieldset>
          <legend>Hands</legend>
          <div className="tiles">
            {handTile('LH', 'Left hand only', 'left')}
            {handTile('RH', 'Right hand only', 'right')}
            {handTile('both', 'Both hands', 'both')}
          </div>
          <small className="placeholder">Pick several to mix them at random.</small>
        </fieldset>

        <fieldset>
          <legend>Notes per hand</legend>
          <div className="tiles">
            {NOTE_COUNTS.map((n) => (
              <ToggleTile
                key={n.value}
                label={n.label}
                note={n.note}
                pressed={settings.notesPerHand.includes(n.value)}
                onToggle={() => edit({ notesPerHand: toggle(settings.notesPerHand, n.value) })}
              >
                <NotesPicture count={n.value} />
              </ToggleTile>
            ))}
            <ToggleTile
              label="5 notes"
              note="extended chords, later"
              pressed={false}
              onToggle={() => {}}
              disabled
            >
              <NotesPicture count={5} />
            </ToggleTile>
          </div>
          <small className="placeholder">
            The same choices for one hand or both. With both hands, each hand gets one of these
            counts and together they make one chord.
          </small>
        </fieldset>

        <label>
          Up to this many sharps/flats
          <select
            value={settings.keys.maxAccidentals}
            onChange={(e) =>
              edit({ keys: { maxAccidentals: Number(e.target.value), explicit: undefined } })
            }
          >
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Keys
          <select
            value={settings.keys.modes}
            onChange={(e) => edit({ keys: { modes: e.target.value as 'both' | Mode } })}
          >
            <option value="both">Major and minor</option>
            <option value="major">Major only</option>
            <option value="minor">Minor only</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={showNames}
            onChange={(e) => setShowNames(e.target.checked)}
          />
          Show note names
        </label>
        <p>
          <button type="button" onClick={() => setSeed((s) => s + 1)}>
            New random seed
          </button>
        </p>
        <details>
          <summary>Settings JSON</summary>
          <pre className="mic-readout">{JSON.stringify(settings, null, 2)}</pre>
        </details>
      </div>

      <Preview
        key={`${JSON.stringify(settings)}|${seed}`}
        settings={settings}
        seed={seed}
        showNames={showNames}
      />
    </>
  )
}
