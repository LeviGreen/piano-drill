import { describe, expect, it } from 'vitest'
import {
  renderNotes,
  renderNoiseBursts,
  type NoiseBurst,
  type SynthNote,
} from '../../test-utils/synthPiano'
import { SpectralAnalyzer } from './SpectralAnalyzer'

const SR = 48000

function onsetsFor(notes: SynthNote[], length: number, noiseDb = -60, sampleRate = SR): number[] {
  const buf = renderNotes(notes, { length, noiseDb, sampleRate })
  const a = new SpectralAnalyzer({ sampleRate })
  // Stream in uneven chunks, like the capture pipeline would deliver.
  const times: number[] = []
  for (let i = 0; i < buf.length;) {
    const n = 300 + ((i * 7) % 700)
    for (const f of a.push(buf.subarray(i, i + n), i))
      for (const o of f.onsets) times.push(o.timeSec)
    i += n
  }
  return times
}

/** Every true onset has a detection within tol, and there are no extra detections. */
function expectOnsets(detected: number[], truth: number[], tolSec = 0.03) {
  expect(detected).toHaveLength(truth.length)
  truth.forEach((t, i) => expect(Math.abs(detected[i] - t)).toBeLessThan(tolSec))
}

describe('onset detection on synthetic piano (acceptance: within ±30 ms)', () => {
  // Measured limit: onsets are found from A1 (MIDI 33, 55 Hz) up. C1..F#1 are missed on this
  // signal; the default app range starts at C2, and low-register work belongs to PD-310.
  it.each([33, 36, 48, 60, 72, 84, 96])('single note, MIDI %i', (midi) => {
    expectOnsets(onsetsFor([{ midi, start: 1, duration: 1.5 }], 3), [1])
  })

  it('also works at 44.1 kHz', () => {
    expectOnsets(onsetsFor([{ midi: 60, start: 1, duration: 1.5 }], 3, -60, 44100), [1])
  })

  it('a chord struck together is one onset', () => {
    const chord = [60, 64, 67].map((midi) => ({ midi, start: 1, duration: 1.5 }))
    expectOnsets(onsetsFor(chord, 3), [1])
  })

  it('a two-hand chord across the range is one onset', () => {
    const chord = [36, 43, 64, 67, 72].map((midi) => ({ midi, start: 1, duration: 1.5 }))
    expectOnsets(onsetsFor(chord, 3), [1])
  })

  it('a slightly rolled chord (30 ms spread) is still within tolerance of the first and last note', () => {
    const rolled = [60, 64, 67].map((midi, i) => ({ midi, start: 1 + i * 0.015, duration: 1.5 }))
    const got = onsetsFor(rolled, 3)
    expect(got.length).toBeGreaterThanOrEqual(1)
    expect(got.length).toBeLessThanOrEqual(3)
    for (const t of got) expect(t).toBeGreaterThan(0.97)
    for (const t of got) expect(t).toBeLessThan(1.06)
  })

  it('separate notes, including a repeated note over the ring-out of the first', () => {
    const notes = [
      { midi: 60, start: 0.5, duration: 1.2 },
      { midi: 60, start: 1.2, duration: 1.2 },
      { midi: 67, start: 1.9, duration: 1.2 },
      { midi: 48, start: 2.6, duration: 1.2 },
    ]
    expectOnsets(onsetsFor(notes, 4.5), [0.5, 1.2, 1.9, 2.6])
  })

  it('a new note while a loud low note rings', () => {
    const notes = [
      { midi: 36, start: 0.5, duration: 3, velocity: 0.9 },
      { midi: 72, start: 1.5, duration: 1, velocity: 0.5 },
    ]
    expectOnsets(onsetsFor(notes, 3.5), [0.5, 1.5])
  })

  it('a soft note (velocity 0.15) in a quiet room', () => {
    expectOnsets(onsetsFor([{ midi: 64, start: 1, duration: 1.5, velocity: 0.15 }], 3), [1])
  })

  it('still works with moderate room noise (-45 dBFS)', () => {
    expectOnsets(onsetsFor([{ midi: 60, start: 1, duration: 1.5 }], 3, -45), [1])
  })

  it('finds no onsets in silence or in steady room noise', () => {
    expect(onsetsFor([], 3, -60)).toEqual([])
    expect(onsetsFor([], 3, -40)).toEqual([])
  })
})

function onsetsInBuffer(buf: Float32Array): number[] {
  const a = new SpectralAnalyzer({ sampleRate: SR })
  const times: number[] = []
  for (let i = 0; i < buf.length; i += 512) {
    for (const f of a.push(buf.subarray(i, i + 512), i))
      for (const o of f.onsets) times.push(o.timeSec)
  }
  return times
}

const mix = (a: Float32Array, b: Float32Array) => a.map((v, i) => v + b[i])
const clicks = (starts: number[], extra: Partial<NoiseBurst> = {}): NoiseBurst[] =>
  starts.map((start) => ({ start, duration: 0.05, level: 0.3, decayMs: 3, ...extra }))

describe('non-musical sounds are ignored (finger brushes, taps, clicks)', () => {
  const opts = { length: 5, noiseDb: -50 }

  it('bright clicks', () => {
    expect(onsetsInBuffer(renderNoiseBursts(clicks([0.5, 1.2, 1.3, 2, 3.1, 4]), opts))).toEqual([])
  })

  it('loud clicks', () => {
    expect(
      onsetsInBuffer(renderNoiseBursts(clicks([0.7, 2.2, 3.4], { level: 0.9 }), opts)),
    ).toEqual([])
  })

  it('dull thumps (low-passed knocks on the desk)', () => {
    const thumps = clicks([0.6, 1.8, 3], { lowpassHz: 300, decayMs: 30, level: 0.8, duration: 0.2 })
    expect(onsetsInBuffer(renderNoiseBursts(thumps, opts))).toEqual([])
  })

  it('rustles (a finger brushed across a surface)', () => {
    const rustles = clicks([0.6, 2, 3.4], {
      lowpassHz: 5000,
      decayMs: 60,
      level: 0.25,
      duration: 0.3,
    })
    expect(onsetsInBuffer(renderNoiseBursts(rustles, opts))).toEqual([])
  })

  it('a real note among clicks gives exactly one onset', () => {
    const noise = renderNoiseBursts(clicks([0.5, 0.9, 2.6, 3.2, 3.9]), opts)
    const note = renderNotes([{ midi: 60, start: 1.5, duration: 1.5 }], { length: 5 })
    expectOnsets(onsetsInBuffer(mix(noise, note)), [1.5])
  })

  it('a click right before or after a note does not hide or duplicate it', () => {
    const noise = renderNoiseBursts(clicks([1.42, 1.58]), opts)
    const note = renderNotes([{ midi: 64, start: 1.5, duration: 1.5 }], { length: 5 })
    const got = onsetsInBuffer(mix(noise, note))
    expect(got).toHaveLength(1)
    expect(Math.abs(got[0] - 1.5)).toBeLessThan(0.05)
  })
})

describe('analyzer behaviour', () => {
  it('reports absolute sample positions when given start offsets, and resets on a gap', () => {
    const a = new SpectralAnalyzer({ sampleRate: SR })
    const buf = renderNotes([{ midi: 60, start: 1, duration: 1 }], { length: 2.5, noiseDb: -60 })
    const offset = 1_000_000
    const first = a.push(buf, offset)
    const onsets = first.flatMap((f) => f.onsets)
    expect(onsets).toHaveLength(1)
    expect(Math.abs(onsets[0].sample - (offset + SR))).toBeLessThan(0.03 * SR)
    // A discontinuity (dropped audio) resets the state without throwing.
    expect(() => a.push(new Float32Array(1024), offset + buf.length + 5000)).not.toThrow()
  })

  it('returns multi-resolution spectra with sensible resolution per band', () => {
    const a = new SpectralAnalyzer({ sampleRate: SR })
    const frames = a.push(
      renderNotes([{ midi: 69, start: 0, duration: 2 }], { length: 1, noiseDb: -60 }),
      0,
    )
    const withSpectra = frames.filter((f) => f.spectra).pop()!
    const bands = withSpectra.spectra!
    expect(bands.map((b) => b.band.fftSize)).toEqual([8192, 4096, 2048])
    expect(bands[0].binHz).toBeLessThan(6)
    const low = bands[0]
    const k = low.magnitudes.indexOf(
      Math.max(...low.magnitudes.subarray(0, Math.round(500 / low.binHz))),
    )
    expect(Math.abs(k * low.binHz - 440)).toBeLessThan(6) // A4 fundamental in the low band
  })

  it('processes a hop in well under 5 ms (acceptance budget; full pipeline incl. spectra)', () => {
    const a = new SpectralAnalyzer({ sampleRate: SR })
    const buf = renderNotes(
      [
        { midi: 48, start: 0.2, duration: 3 },
        { midi: 64, start: 0.4, duration: 3 },
      ],
      { length: 4, noiseDb: -60 },
    )
    a.push(buf.subarray(0, SR), 0) // warm up the JIT
    const t0 = performance.now()
    const frames = a.push(buf.subarray(SR), SR)
    const msPerFrame = (performance.now() - t0) / frames.length
    expect(msPerFrame).toBeLessThan(5)
  })
})
