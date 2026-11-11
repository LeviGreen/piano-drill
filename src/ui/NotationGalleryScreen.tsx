import { Link } from 'react-router'
import { Staff } from '../notation/Staff'
import { keyName, keySignature } from '../theory/keys'

/** Signatures from none to seven accidentals, flats before sharps at each count. */
const ORDER = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7]

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
    </>
  )
}
