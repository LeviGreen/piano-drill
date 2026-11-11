import { renderNoiseBursts, renderNotes, type SynthNote } from '../test-utils/synthPiano'

export type Category =
  | 'single'
  | 'interval'
  | 'triad'
  | 'two-hand'
  | 'wrong-note'
  | 'extra-note'
  | 'silence'
  | 'room-noise'
  | 'transient'

export type Source = 'synthetic' | 'acoustic' | 'digital-speaker'

export type Clip = {
  id: string
  category: Category
  source: Source
  sampleRate: number
  samples: Float32Array
  /** MIDI notes actually played (empty for silence / noise / transients). */
  played: number[]
  /** The target the verifier is told to expect. */
  expected: number[]
  /** Ground-truth onset time in seconds, when known (synthetic clips). */
  onsetSec?: number
  condition?: string
}

/** A clip should be accepted when what was played is exactly what was expected. */
export const shouldAccept = (c: Pick<Clip, 'played' | 'expected'>): boolean =>
  c.played.length === c.expected.length && c.played.every((n) => c.expected.includes(n))

// --- recorded clips: one corpus/recorded/<id>.json per clip (see corpus/README.md) ------------

export type ManifestEntry = {
  id: string
  file: string
  source: Source
  category: Category
  /** Note names ("C4") or MIDI numbers. */
  played: (string | number)[]
  expected: (string | number)[]
  onsetSec?: number
  room?: string
  device?: string
  position?: string
  notes?: string
}

// --- synthetic corpus -------------------------------------------------------------------------

const SR = 48000
const LENGTH = 2.5
const START = 1.0
const DURATION = 1.2

function notesAt(midis: number[], extra: Partial<SynthNote> = {}): SynthNote[] {
  return midis.map((midi) => ({ midi, start: START, duration: DURATION, ...extra }))
}

let seedCounter = 100
function playClip(
  id: string,
  category: Category,
  played: number[],
  expected: number[],
  opts: { noiseDb?: number; detuneCents?: number; condition?: string } = {},
): Clip {
  const samples = renderNotes(notesAt(played, { detuneCents: opts.detuneCents }), {
    sampleRate: SR,
    length: LENGTH,
    noiseDb: opts.noiseDb ?? -60,
    seed: seedCounter++,
  })
  return {
    id,
    category,
    source: 'synthetic',
    sampleRate: SR,
    samples,
    played,
    expected,
    onsetSec: played.length ? START : undefined,
    condition: opts.condition ?? `noise ${opts.noiseDb ?? -60} dB`,
  }
}

/** Deterministic synthetic corpus: no audio files in git, same clips on every run. */
export function syntheticCorpus(): Clip[] {
  seedCounter = 100
  const clips: Clip[] = []
  const name = (m: number) => `m${m}`

  for (const m of [36, 40, 45, 48, 52, 57, 60, 64, 69, 72, 76, 81, 84, 88, 93]) {
    clips.push(playClip(`single-${name(m)}`, 'single', [m], [m]))
  }
  for (const m of [40, 52, 60, 69, 81]) {
    clips.push(playClip(`single-${name(m)}-noisy`, 'single', [m], [m], { noiseDb: -45 }))
    clips.push(
      playClip(`single-${name(m)}-detuned`, 'single', [m], [m], {
        detuneCents: 25,
        condition: 'detuned +25 cents',
      }),
    )
  }
  for (const [low, size] of [
    [48, 4],
    [55, 7],
    [60, 3],
    [64, 5],
    [67, 9],
    [72, 12],
    [79, 2],
    [45, 7],
  ]) {
    clips.push(
      playClip(`interval-${name(low)}-${size}`, 'interval', [low, low + size], [low, low + size]),
    )
  }
  ;[
    [36, 'M'],
    [43, 'm'],
    [48, 'M'],
    [55, 'm'],
    [60, 'M'],
    [64, 'm'],
    [67, 'M'],
    [72, 'm'],
    [79, 'M'],
  ].forEach(([root, q]) => {
    const r = root as number
    const triad = [r, r + (q === 'M' ? 4 : 3), r + 7]
    clips.push(playClip(`triad-${name(r)}-${q}`, 'triad', triad, triad))
  })
  for (const [lh, rh] of [
    [36, 60],
    [38, 62],
    [41, 65],
    [43, 67],
    [45, 69],
    [48, 72],
  ]) {
    const chord = [lh, lh + 7, rh + 4, rh + 7, rh + 12]
    clips.push(playClip(`twohand-${name(lh)}-${name(rh)}`, 'two-hand', chord, chord))
  }

  // Negative cases: the verifier must NOT accept these.
  const wrong: [string, number[], number[]][] = [
    ['semitone', [61], [60]],
    ['octave-up', [72], [60]],
    ['octave-down', [48], [60]],
    ['minor-for-major', [60, 63, 67], [60, 64, 67]],
    ['one-note-off', [60, 64, 66], [60, 64, 67]],
    ['fifth-for-fourth', [48, 55], [48, 53]],
    ['wrong-root', [62, 66, 69], [60, 64, 67]],
    ['bass-octave', [36, 43, 64], [48, 55, 64]],
  ]
  for (const [label, played, expected] of wrong) {
    clips.push(playClip(`wrong-${label}`, 'wrong-note', played, expected))
  }
  const extra: [string, number[], number[]][] = [
    ['added-octave', [60, 64, 67, 72], [60, 64, 67]],
    ['added-fifth', [60, 67], [60]],
    ['added-seventh', [48, 55, 59], [48, 55]],
    ['added-bass', [36, 60, 64, 67], [60, 64, 67]],
    ['added-semitone', [60, 61], [60]],
  ]
  for (const [label, played, expected] of extra) {
    clips.push(playClip(`extra-${label}`, 'extra-note', played, expected))
  }

  // Nothing played: any acceptance is a false accept.
  for (const db of [-70, -60, -50]) {
    clips.push({
      ...playClip(`silence-${-db}`, 'silence', [], [60], { noiseDb: db }),
      expected: [60],
    })
  }
  for (const db of [-45, -40, -35]) {
    clips.push({
      ...playClip(`room-noise-${-db}`, 'room-noise', [], [60, 64, 67], { noiseDb: db }),
    })
  }
  const burst = (start: number, extra = {}) => ({
    start,
    duration: 0.3,
    level: 0.5,
    decayMs: 3,
    ...extra,
  })
  const transients: [string, ReturnType<typeof burst>[]][] = [
    ['clicks', [burst(0.8), burst(1.4), burst(2)]],
    ['thumps', [burst(1, { lowpassHz: 300, decayMs: 30 })]],
    ['rustle', [burst(1, { lowpassHz: 5000, decayMs: 60, level: 0.25 })]],
  ]
  for (const [label, bursts] of transients) {
    clips.push({
      id: `transient-${label}`,
      category: 'transient',
      source: 'synthetic',
      sampleRate: SR,
      samples: renderNoiseBursts(bursts, {
        sampleRate: SR,
        length: LENGTH,
        noiseDb: -50,
        seed: seedCounter++,
      }),
      played: [],
      expected: [60],
      condition: 'non-musical sound',
    })
  }
  return clips
}
