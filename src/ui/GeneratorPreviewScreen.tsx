import { useState } from 'react'
import { Link } from 'react-router'
import { GrandStaff } from '../notation/GrandStaff'
import { PianoKeyboard, type KeyMark } from '../notation/PianoKeyboard'
import type { ChordSize } from '../theory/chords'
import {
  DEFAULT_SINGLE_HAND_CONFIG,
  keysUpTo,
  TargetGenerator,
  type NotesPerHand,
  type SingleHandConfig,
} from '../theory/generator'
import { keyName, type Mode } from '../theory/keys'
import { formatPitch } from '../theory/pitch'
import { mulberry32, pick } from '../theory/random'
import type { Hand, Target } from '../theory/target'
import { DEFAULT_TWO_HAND_CONFIG, TwoHandGenerator, type TwoHandConfig } from '../theory/twoHand'
import { HandsPicture, NotesPicture } from './HandPictures'
import { ToggleTile } from './ToggleTile'

type HandMode = 'LH' | 'RH' | 'both'
type Mark = 'almost' | 'heard' | 'wrong'

const NOTE_COUNTS: { value: NotesPerHand; label: string; note: string }[] = [
  { value: 1, label: '1 note', note: 'single note' },
  { value: 2, label: '2 notes', note: 'interval' },
  { value: 3, label: '3 notes', note: 'triad' },
  { value: 4, label: '4 notes', note: 'seventh chord' },
]

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
    return `${keyName(t.key)}: ${lh.label} (${t.content.voicing})  LH [${names(lh.pitches)}]  RH [${names(rh.pitches)}]`
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

/** One target source mixing the chosen hand modes: a random one is picked for each target. */
function makeSource(
  single: SingleHandConfig | null,
  two: TwoHandConfig | null,
  seed: number,
): { next(): Target } {
  const gens: { next(): Target }[] = []
  if (single) gens.push(new TargetGenerator(single, seed))
  if (two) gens.push(new TwoHandGenerator(two, seed + 1))
  const rng = mulberry32(seed + 2)
  return { next: () => pick(rng, gens).next() }
}

/** Shows generated targets for one configuration. Remounted (via key) when the settings change. */
function Preview({
  single,
  two,
  seed,
  showNames,
}: {
  single: SingleHandConfig | null
  two: TwoHandConfig | null
  seed: number
  showNames: boolean
}) {
  const [source] = useState(() => makeSource(single, two, seed))
  const [history, setHistory] = useState<Target[]>(() => [source.next()])
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
    setHistory((h) => [source.next(), ...h].slice(0, 8))
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

/** Dev screen for PD-105/106/202/203/205: generate targets and see them drawn. (PD-404 builds the real preview.) */
export function GeneratorPreviewScreen() {
  const [modes, setModes] = useState<HandMode[]>(['RH'])
  const [counts, setCounts] = useState<NotesPerHand[]>([3])
  const [maxAcc, setMaxAcc] = useState(2)
  const [keyModes, setKeyModes] = useState<'both' | Mode>('both')
  const [showNames, setShowNames] = useState(false)
  const [seed, setSeed] = useState(1)

  const keys = keysUpTo(maxAcc, keyModes === 'both' ? ['major', 'minor'] : [keyModes])
  const hands = modes.filter((m): m is Hand => m !== 'both')
  const single: SingleHandConfig | null =
    hands.length > 0
      ? {
          ...DEFAULT_SINGLE_HAND_CONFIG,
          hands,
          notesPerHand: counts,
          keys,
          inversions: true, // always allowed
          alterations: 0.2, // occasional chromatic notes, always allowed
          minorForm: 'either',
        }
      : null
  const sizes: ChordSize[] = counts.includes(4)
    ? counts.includes(3)
      ? ['triad', 'seventh']
      : ['seventh']
    : ['triad']
  const two: TwoHandConfig | null = modes.includes('both')
    ? { ...DEFAULT_TWO_HAND_CONFIG, keys, chordSizes: sizes, minorForm: 'either' }
    : null

  const handTile = (mode: HandMode, label: string, pic: 'left' | 'right' | 'both') => (
    <ToggleTile
      label={label}
      pressed={modes.includes(mode)}
      onToggle={() => setModes((ms) => toggle(ms, mode))}
    >
      <HandsPicture hands={pic} />
    </ToggleTile>
  )

  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Generator preview</h1>
      <p className="placeholder">
        Targets from the generators (PD-105, PD-106) drawn on the staff (PD-201 to 203), within G2
        to F5. Inversions and occasional chromatic notes are always on.
      </p>

      <div className="recorder-form">
        <fieldset>
          <legend>Hands</legend>
          <div className="tiles">
            {handTile('LH', 'Left hand only', 'left')}
            {handTile('RH', 'Right hand only', 'right')}
            {handTile('both', 'Both hands', 'both')}
          </div>
          <small className="placeholder">
            Pick several to mix them at random. With both hands, 3 notes means triads and 4 means
            seventh chords, split between the hands.
          </small>
        </fieldset>
        <fieldset>
          <legend>Notes per hand</legend>
          <div className="tiles">
            {NOTE_COUNTS.map((n) => (
              <ToggleTile
                key={n.value}
                label={n.label}
                note={n.note}
                pressed={counts.includes(n.value)}
                onToggle={() => setCounts((cs) => toggle(cs, n.value))}
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
        </fieldset>
        <label>
          Up to this many sharps/flats
          <select value={maxAcc} onChange={(e) => setMaxAcc(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Keys
          <select value={keyModes} onChange={(e) => setKeyModes(e.target.value as 'both' | Mode)}>
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
      </div>

      <Preview
        key={`${modes}|${counts}|${maxAcc}|${keyModes}|${seed}`}
        single={single}
        two={two}
        seed={seed}
        showNames={showNames}
      />
    </>
  )
}
