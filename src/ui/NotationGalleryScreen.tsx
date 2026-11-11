import { Link } from 'react-router'
import { Staff } from '../notation/Staff'
import { keyName, keySignature, type KeySignature } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import type { Clef } from '../theory/staff'

/** Signatures from none to seven accidentals, flats before sharps at each count. */
const ORDER = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7]

type Tricky = { title: string; clef: Clef; key: KeySignature; notes: string[] }
const C = keySignature(0, 'major')
const TRICKY: Tricky[] = [
  { title: 'Adjacent seconds', clef: 'treble', key: C, notes: ['E4', 'F4', 'G4'] },
  { title: 'A cluster of four seconds', clef: 'treble', key: C, notes: ['C4', 'D4', 'E4', 'F4'] },
  { title: 'Three ledger lines below', clef: 'treble', key: C, notes: ['F3', 'A3', 'C4'] },
  { title: 'Three ledger lines above', clef: 'treble', key: C, notes: ['C6', 'E6'] },
  { title: 'Bass clef, ledger lines below', clef: 'bass', key: C, notes: ['C2', 'E2', 'G2'] },
  { title: 'Double sharp and double flat', clef: 'treble', key: C, notes: ['F##4', 'Bbb4', 'D5'] },
  {
    title: 'D major chord in D major (no accidentals)',
    clef: 'treble',
    key: keySignature(2, 'major'),
    notes: ['D4', 'F#4', 'A4'],
  },
  {
    title: 'Same chord in C major (needs the sharp)',
    clef: 'treble',
    key: C,
    notes: ['D4', 'F#4', 'A4'],
  },
  {
    title: 'Natural sign: F in D major',
    clef: 'treble',
    key: keySignature(2, 'major'),
    notes: ['F4', 'A4'],
  },
]

const heading = (n: number) =>
  n === 0
    ? 'No sharps or flats'
    : `${Math.abs(n)} ${n < 0 ? 'flat' : 'sharp'}${Math.abs(n) > 1 ? 's' : ''}`

/** Visual check for PD-201: every key signature on both clefs, fewest accidentals first. */
export function NotationGalleryScreen() {
  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Notation gallery</h1>
      <p className="placeholder">
        All 30 keys on treble and bass staves (PD-201), from no accidentals to seven. A major key
        and its relative minor share one signature.
      </p>
      <div className="gallery">
        {ORDER.map((n) => {
          const major = keySignature(n, 'major')
          const minor = keySignature(n, 'minor')
          const names = `${keyName(major)} / ${keyName(minor)}`
          return (
            <section key={n} className="gallery-item">
              <h2>{heading(n)}</h2>
              <p className="gallery-keys">{names}</p>
              <Staff clef="treble" keySignature={major} label={`${names}, treble clef`} />
              <Staff clef="bass" keySignature={major} label={`${names}, bass clef`} />
            </section>
          )
        })}
      </div>

      <h2>Tricky cases (PD-202)</h2>
      <div className="tricky">
        {TRICKY.map((c) => (
          <section key={c.title} className="gallery-item">
            <h2>{c.title}</h2>
            <p className="gallery-keys">
              {c.notes.join(' ')} · {keyName(c.key)}
            </p>
            <Staff
              clef={c.clef}
              keySignature={c.key}
              notes={c.notes.map(parsePitch)}
              ledgerRoom={3}
              label={c.title}
            />
          </section>
        ))}
      </div>
    </>
  )
}
