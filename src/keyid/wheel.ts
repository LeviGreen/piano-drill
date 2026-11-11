import { keyName, keySignature, type Mode } from '../theory/keys'

/**
 * Geometry of the circle-of-fifths answer wheel: an outer ring of major keys and an inner ring of their relative
 * minors. Twelve positions run clockwise from the top (C, G, D, A, E, B, F♯, D♭, A♭, E♭, B♭, F). Three positions
 * hold two keys with different signatures (B and C♭, F♯ and G♭, C♯ and D♭), so those split in half: the sharp
 * key on the side the sharps arrive from, the flat key on the other.
 */
export type WheelSector = {
  accidentals: number
  mode: Mode
  /** Start and end angle in degrees, clockwise from the top. */
  from: number
  to: number
  innerRadius: number
  outerRadius: number
  /** "E♭" for a major key, "Cm" for a minor key. */
  label: string
  /** Full name for screen readers, e.g. "E♭ major". */
  name: string
  split: boolean
}

export const WHEEL = {
  size: 200,
  center: 100,
  majorOuter: 96,
  majorInner: 66,
  minorOuter: 64,
  minorInner: 30,
}

/** Position on the wheel (0-11) of a signature. */
export function wheelPosition(accidentals: number): number {
  // n sharps is n steps clockwise from C; n flats is n steps counter-clockwise (so -1 is position 11).
  return ((accidentals % 12) + 12) % 12
}

const SHARED = new Set([5, 6, 7])

export function wheelSectors(): WheelSector[] {
  const out: WheelSector[] = []
  for (let n = -7; n <= 7; n++) {
    const pos = wheelPosition(n)
    const split = SHARED.has(pos)
    const centre = pos * 30
    // Sharps take the lower-angle half of a shared position; flats the upper half.
    const [from, to] = !split
      ? [centre - 15, centre + 15]
      : n > 0
        ? [centre - 15, centre]
        : [centre, centre + 15]
    for (const mode of ['major', 'minor'] as const) {
      const key = keySignature(n, mode)
      const letter = `${key.tonic.letter}${['𝄫', '♭', '', '♯', '𝄪'][key.tonic.accidental + 2]}`
      out.push({
        accidentals: n,
        mode,
        from,
        to,
        innerRadius: mode === 'major' ? WHEEL.majorInner : WHEEL.minorInner,
        outerRadius: mode === 'major' ? WHEEL.majorOuter : WHEEL.minorOuter,
        label: mode === 'major' ? letter : `${letter}m`,
        name: keyName(key),
        split,
      })
    }
  }
  return out
}

const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
const point = (r: number, deg: number) =>
  `${(WHEEL.center + r * Math.cos(rad(deg))).toFixed(2)} ${(WHEEL.center + r * Math.sin(rad(deg))).toFixed(2)}`

/** SVG path for a ring sector (a slice of an annulus), with a small gap between neighbours. */
export function sectorPath(s: WheelSector, gap = 0.6): string {
  const [a, b] = [s.from + gap, s.to - gap]
  return [
    `M ${point(s.outerRadius, a)}`,
    `A ${s.outerRadius} ${s.outerRadius} 0 0 1 ${point(s.outerRadius, b)}`,
    `L ${point(s.innerRadius, b)}`,
    `A ${s.innerRadius} ${s.innerRadius} 0 0 0 ${point(s.innerRadius, a)}`,
    'Z',
  ].join(' ')
}

/**
 * How far to turn a sector's label, in degrees. Half-width sectors are too narrow for a horizontal label, so
 * their labels run along the sector (outward from the centre), flipped on the left half so they are never
 * upside down. Full-width sectors keep horizontal labels (0).
 */
export function labelRotation(s: WheelSector): number {
  if (!s.split) return 0
  const mid = (s.from + s.to) / 2
  const outward = mid - 90 // text along the radius, reading outward
  // Text reads upside down when it points leftward, which is when the sector is on the left half of the wheel.
  return mid > 180 && mid < 360 ? outward - 180 : outward
}

/** Where to draw a sector's label: the middle of the sector. */
export function labelPoint(s: WheelSector): { x: number; y: number } {
  const r = (s.innerRadius + s.outerRadius) / 2
  const mid = (s.from + s.to) / 2
  return { x: WHEEL.center + r * Math.cos(rad(mid)), y: WHEEL.center + r * Math.sin(rad(mid)) }
}
