import { useState } from 'react'
import { Link } from 'react-router'
import { Staff } from '../notation/Staff'
import {
  DEFAULT_SINGLE_HAND_CONFIG,
  keysUpTo,
  TargetGenerator,
  type SingleHandConfig,
  type NotesPerHand,
} from '../theory/generator'
import { keyName, type Mode } from '../theory/keys'
import { formatPitch } from '../theory/pitch'
import { HandsPicture, NotesPicture } from './HandPictures'
import { ToggleTile } from './ToggleTile'
import type { Hand, Target } from '../theory/target'

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

function describe(t: Target): string {
  const part = t.parts[0]
  const what =
    t.content.type === 'note'
      ? 'note'
      : t.content.type === 'interval'
        ? `interval ${t.content.quality}`
        : `${part.label} ${t.content.type}, ${ORDINAL[t.content.inversion ?? 0]}`
  return `${keyName(t.key)}: ${what}  [${part.pitches.map(formatPitch).join(' ')}]`
}

/** Shows generated targets for one configuration. Remounted (via key) when the settings change. */
function Preview({ config, seed }: { config: SingleHandConfig; seed: number }) {
  const [generator] = useState(() => new TargetGenerator(config, seed))
  const [history, setHistory] = useState<Target[]>(() => [generator.next()])
  const current = history[0]
  return (
    <>
      <p>
        <button
          type="button"
          onClick={() => setHistory((h) => [generator.next(), ...h].slice(0, 8))}
        >
          Next target
        </button>
      </p>
      <Staff
        clef={current.parts[0].clef}
        keySignature={current.key}
        notes={current.parts[0].pitches}
        label={describe(current)}
      />
      <p>
        <strong>{describe(current)}</strong>
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

/** Dev screen for PD-105/PD-202: generate one-hand targets and see them drawn. (PD-404 will build the real preview.) */
export function GeneratorPreviewScreen() {
  const [hands, setHands] = useState<Hand[]>(['RH'])
  const [counts, setCounts] = useState<NotesPerHand[]>([3])
  const [maxAcc, setMaxAcc] = useState(2)
  const [modes, setModes] = useState<'both' | Mode>('both')
  const [seed, setSeed] = useState(1)

  const config: SingleHandConfig = {
    ...DEFAULT_SINGLE_HAND_CONFIG,
    hands,
    notesPerHand: counts,
    keys: keysUpTo(maxAcc, modes === 'both' ? ['major', 'minor'] : [modes]),
    inversions: true, // always allowed
    alterations: 0.2, // occasional chromatic notes, always allowed
    minorForm: 'either',
  }
  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Generator preview</h1>
      <p className="placeholder">
        One-hand targets from the generator (PD-105) drawn on the staff (PD-201/202), within G2 to
        F5. Inversions and occasional chromatic notes are always on.
      </p>

      <div className="recorder-form">
        <fieldset>
          <legend>Hands</legend>
          <div className="tiles">
            <ToggleTile
              label="Left hand only"
              pressed={hands.includes('LH')}
              onToggle={() => setHands((hs) => toggle(hs, 'LH'))}
            >
              <HandsPicture hands="left" />
            </ToggleTile>
            <ToggleTile
              label="Right hand only"
              pressed={hands.includes('RH')}
              onToggle={() => setHands((hs) => toggle(hs, 'RH'))}
            >
              <HandsPicture hands="right" />
            </ToggleTile>
            <ToggleTile
              label="Both hands"
              note="coming with PD-106"
              pressed={false}
              onToggle={() => {}}
              disabled
            >
              <HandsPicture hands="both" />
            </ToggleTile>
          </div>
          <small className="placeholder">
            Pick both single hands to alternate between them at random.
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
          <select value={modes} onChange={(e) => setModes(e.target.value as 'both' | Mode)}>
            <option value="both">Major and minor</option>
            <option value="major">Major only</option>
            <option value="minor">Minor only</option>
          </select>
        </label>
        <p>
          <button type="button" onClick={() => setSeed((s) => s + 1)}>
            New random seed
          </button>
        </p>
      </div>

      <Preview key={`${hands}|${counts}|${maxAcc}|${modes}|${seed}`} config={config} seed={seed} />
    </>
  )
}
