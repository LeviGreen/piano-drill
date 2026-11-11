import type { Chord, ChordRole, ChordSize } from './chords'
import { pitch, type Pitch, type Spelling } from './pitch'
import { pick, randInt, type Rng } from './random'

/**
 * Two-hand voicings (design §4.3): templates are data, and `buildVoicing` interprets them to split one
 * diatonic chord between the hands. Add a template to VOICING_TEMPLATES to add a voicing; levels choose
 * which templates they allow.
 */
export type VoicingKind = 'bass-plus-chord' | 'shell' | 'split' | 'octave-doubling'
export type LhRole = ChordRole | 'root+octave'

export type VoicingTemplate = {
  id: string
  name: string
  kind: VoicingKind
  /** Chord sizes this voicing makes sense for. */
  sizes: ChordSize[]
  /**
   * Left-hand tones. The first is placed below the right hand; the rest sit above it (a root and its
   * fifth, say). 'root+octave' is the root plus the root an octave higher.
   */
  lhRoles?: LhRole[]
  /** Extra octaves the left hand may drop below the right hand; one is chosen at random. */
  drops?: number[]
  /** For 'split': MIDI note that divides left from right (middle C = 60). */
  splitAt?: number
  /** For 'octave-doubling': how many octaves below the right hand the doubled note sits. */
  doubleOctaves?: number[]
}

export const VOICING_TEMPLATES: VoicingTemplate[] = [
  {
    id: 'bass-root',
    name: 'Bass root + chord',
    kind: 'bass-plus-chord',
    sizes: ['triad', 'seventh'],
    lhRoles: ['root'],
    drops: [0, 1],
  },
  {
    id: 'bass-root-fifth',
    name: 'Bass root and fifth + chord',
    kind: 'bass-plus-chord',
    sizes: ['triad', 'seventh'],
    lhRoles: ['root', 'fifth'],
    drops: [0, 1],
  },
  {
    id: 'bass-octave',
    name: 'Bass octave + chord',
    kind: 'bass-plus-chord',
    sizes: ['triad', 'seventh'],
    lhRoles: ['root', 'root+octave'],
    drops: [0, 1],
  },
  {
    id: 'shell-triad',
    name: 'Shell (root + third), rest in the right hand',
    kind: 'shell',
    sizes: ['triad'],
    lhRoles: ['root', 'third'],
    drops: [0, 1],
  },
  {
    id: 'shell-seventh',
    name: 'Shell (root + seventh), rest in the right hand',
    kind: 'shell',
    sizes: ['seventh'],
    lhRoles: ['root', 'seventh'],
    drops: [0, 1],
  },
  {
    id: 'split',
    name: 'Split chord around middle C',
    kind: 'split',
    sizes: ['triad', 'seventh'],
    splitAt: 60,
  },
  {
    id: 'octave-doubling',
    name: 'Left hand doubles a note an octave or two below',
    kind: 'octave-doubling',
    sizes: ['triad', 'seventh'],
    doubleOctaves: [1, 2],
  },
]

export const templateById = (id: string): VoicingTemplate => {
  const t = VOICING_TEMPLATES.find((x) => x.id === id)
  if (!t) throw new RangeError(`Unknown voicing template: ${id}`)
  return t
}

export type Voicing = { lh: Pitch[]; rh: Pitch[] }

const base = (s: Spelling): number => pitch(s.letter, s.accidental, 0).midi

/** The pitch with this spelling that is the highest one strictly below `ceiling` (a MIDI number). */
function placeBelow(s: Spelling, ceiling: number, extraOctaves: number): Pitch {
  const octave = Math.floor((ceiling - 1 - base(s)) / 12) - extraOctaves
  return pitch(s.letter, s.accidental, octave)
}

/** The pitch with this spelling that is the lowest one strictly above `floor`. */
function placeAbove(s: Spelling, floor: number): Pitch {
  return pitch(s.letter, s.accidental, Math.floor((floor - base(s)) / 12) + 1)
}

const byPitch = (a: Pitch, b: Pitch): number => a.midi - b.midi

/**
 * Split `chord` between the hands according to `template`, or null if it cannot be done. The result is
 * not checked for playability; the generator validates it. Every chord tone is always present in the
 * union of the two hands, so the chord stays identifiable.
 */
export function buildVoicing(template: VoicingTemplate, chord: Chord, rng: Rng): Voicing | null {
  if (!template.sizes.includes(chord.size)) return null
  const spelling = (role: ChordRole): Spelling | undefined =>
    chord.tones.find((t) => t.role === role)?.pitch.spelling

  if (template.kind === 'octave-doubling') {
    const rh = chord.pitches
    const doubled = pick(rng, rh).spelling
    const octaves = pick(rng, template.doubleOctaves ?? [1])
    return { lh: [pitch(doubled.letter, doubled.accidental, doubled.octave - octaves)], rh }
  }

  if (template.kind === 'split') {
    const at = template.splitAt ?? 60
    const placed = chord.tones.map((t) => {
      const s = t.pitch.spelling
      return pitch(s.letter, s.accidental, s.octave + randInt(rng, 3) - 1) // each tone: an octave lower, same or higher
    })
    if (new Set(placed.map((p) => p.midi)).size !== placed.length) return null
    const lh = placed.filter((p) => p.midi < at).sort(byPitch)
    const rh = placed.filter((p) => p.midi >= at).sort(byPitch)
    return lh.length > 0 && rh.length > 0 ? { lh, rh } : null
  }

  // 'bass-plus-chord' and 'shell': the left hand plays chosen chord tones below the right hand.
  const roles = template.lhRoles ?? []
  const chordRoles = roles.map((r) => (r === 'root+octave' ? 'root' : r))
  if (chordRoles.some((r) => !spelling(r))) return null
  const rh =
    template.kind === 'shell'
      ? chord.tones.filter((t) => !chordRoles.includes(t.role)).map((t) => t.pitch)
      : chord.pitches
  if (rh.length === 0) return null

  const drop = pick(rng, template.drops ?? [0])
  const lh: Pitch[] = []
  roles.forEach((role, i) => {
    const s = spelling(role === 'root+octave' ? 'root' : role)!
    if (i === 0) {
      lh.push(placeBelow(s, Math.min(...rh.map((p) => p.midi)), drop))
    } else if (role === 'root+octave') {
      lh.push(pitch(s.letter, s.accidental, lh[0].spelling.octave + 1))
    } else {
      lh.push(placeAbove(s, lh[0].midi))
    }
  })
  return { lh: lh.sort(byPitch), rh: [...rh].sort(byPitch) }
}
