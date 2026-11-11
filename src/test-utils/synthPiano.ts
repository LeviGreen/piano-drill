/**
 * Synthetic piano for deterministic DSP tests: inharmonic partials with per-partial exponential
 * decay, a short attack ramp and optional seeded background noise. Not a realistic piano, but it has
 * the features the analyzer must cope with (stretched partials, fast attack, long ring-out).
 */
export type SynthNote = {
  midi: number
  /** Seconds from the start of the buffer. */
  start: number
  duration: number
  /** 0..1, default 0.7. */
  velocity?: number
  /** Tuning offset in cents (to model an out-of-tune piano). */
  detuneCents?: number
}

export type SynthOptions = {
  sampleRate?: number
  /** Total length in seconds. */
  length: number
  /** White noise level in dBFS (RMS). Omit for silence. */
  noiseDb?: number
  seed?: number
}

// Small seeded PRNG so tests are repeatable.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

export function renderNotes(notes: SynthNote[], opts: SynthOptions): Float32Array {
  const sr = opts.sampleRate ?? 48000
  const out = new Float32Array(Math.round(opts.length * sr))
  const rand = mulberry32(opts.seed ?? 1)
  const attack = Math.round(0.002 * sr)
  const release = Math.round(0.05 * sr)

  for (const note of notes) {
    const f0 = midiToHz(note.midi) * 2 ** ((note.detuneCents ?? 0) / 1200)
    const vel = note.velocity ?? 0.7
    const B = 0.0004 // inharmonicity coefficient
    const tau0 = 0.5 + 4 * Math.exp(-(note.midi - 21) / 40) // lower notes ring longer
    const first = Math.round(note.start * sr)
    const n = Math.round(note.duration * sr)
    for (let h = 1; h <= 16; h++) {
      const f = h * f0 * Math.sqrt(1 + B * h * h)
      if (f > sr * 0.45) break
      const amp = (0.25 * vel) / h
      const tau = tau0 / (1 + 0.4 * (h - 1))
      const phase = rand() * 2 * Math.PI
      const w = (2 * Math.PI * f) / sr
      for (let i = 0; i < n; i++) {
        const idx = first + i
        if (idx >= out.length) break
        let env = Math.exp(-i / (tau * sr))
        if (i < attack) env *= i / attack
        if (i > n - release) env *= Math.max(0, (n - i) / release)
        out[idx] += amp * env * Math.sin(w * i + phase)
      }
    }
  }

  if (opts.noiseDb !== undefined) {
    const sigma = 10 ** (opts.noiseDb / 20)
    for (let i = 0; i < out.length; i++) {
      // Box-Muller
      const u = Math.max(rand(), 1e-12)
      out[i] += sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
    }
  }
  return out
}

export type NoiseBurst = {
  start: number
  /** Seconds the burst lasts before it has fully died away. */
  duration: number
  /** Peak amplitude, 0..1. */
  level: number
  /** Exponential decay time constant in ms (small = click, larger = rustle). */
  decayMs: number
  /** One-pole low-pass cutoff in Hz to make dull thumps (omit for a bright click). */
  lowpassHz?: number
}

/** Non-musical transients (clicks, finger taps, rustles) for testing that they are rejected. */
export function renderNoiseBursts(bursts: NoiseBurst[], opts: SynthOptions): Float32Array {
  const sr = opts.sampleRate ?? 48000
  const out = renderNotes([], opts)
  const rand = mulberry32((opts.seed ?? 1) + 1000)
  for (const b of bursts) {
    const first = Math.round(b.start * sr)
    const n = Math.round(b.duration * sr)
    const alpha = b.lowpassHz ? 1 - Math.exp((-2 * Math.PI * b.lowpassHz) / sr) : 1
    let y = 0
    for (let i = 0; i < n && first + i < out.length; i++) {
      y += alpha * (rand() * 2 - 1 - y)
      out[first + i] += b.level * y * Math.exp(-i / ((b.decayMs / 1000) * sr))
    }
  }
  return out
}
