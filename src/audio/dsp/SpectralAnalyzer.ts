import { NoiseFloor } from './noiseFloor'
import { countTonalPeaks, SpectrumAnalyzer } from './spectrum'

export type BandSpec = { fftSize: number; minHz: number; maxHz: number }

/**
 * Multi-resolution analysis: long windows for the bass (fine frequency resolution), short windows
 * for the treble (fine time resolution).
 */
export const DEFAULT_BANDS: BandSpec[] = [
  { fftSize: 8192, minHz: 20, maxHz: 500 },
  { fftSize: 4096, minHz: 500, maxHz: 2000 },
  { fftSize: 2048, minHz: 2000, maxHz: 8000 },
]

export type AnalyzerOptions = {
  sampleRate: number
  /** Samples between analysis steps (default 256, about 5 ms at 48 kHz). */
  hop?: number
  /** FFT size for onset detection (default 1024). */
  onsetFftSize?: number
  bands?: BandSpec[]
  /** Compute the multi-resolution spectra (every `spectraEvery` hops). Default true. */
  spectra?: boolean
  spectraEvery?: number
}

export type BandSpectrum = {
  band: BandSpec
  binHz: number
  magnitudes: Float64Array
  noiseFloor: Float64Array
}

export type OnsetEvent = {
  /** Estimated sample index of the note attack (fractional, absolute within the pushed stream). */
  sample: number
  timeSec: number
  /** Spectral flux at the onset, in noise-floor-relative log units. */
  strength: number
}

export type AnalysisFrame = {
  /** Absolute index of the last sample included in this step. */
  endSample: number
  flux: number
  onsets: OnsetEvent[]
  spectra?: BandSpectrum[]
}

// Onset detection tuning (see SpectralAnalyzer.test.ts, which measures these on synthetic piano).
const FLUX_HISTORY = 24
const MEDIAN_MULTIPLIER = 2
const MIN_FLUX = 12
const MIN_ONSET_GAP_SEC = 0.05 // between candidates
/** Between confirmed onsets. Longer, so a note still filling the long windows can't vouch for a later click, and a rolled chord stays one attempt. */
const MIN_CONFIRMED_GAP_SEC = 0.15
const WARMUP_HOPS = 40 // ~0.2 s: the longest analysis window must be full so the noise floors are valid
/**
 * A candidate onset is checked for pitched peaks from this many hops after it, and again every hop
 * until the deadline (bass notes need longer: their closely spaced partials only separate once
 * enough of the note has entered the long analysis window). Clicks never become pitched and are dropped.
 */
const CONFIRM_DELAY_HOPS = 6
const CONFIRM_DEADLINE_HOPS = 26 // ~140 ms at 48 kHz / hop 256
/** Pitched-peak test: peaks must be this far above the noise floor and above their local median... */
const TONAL_SNR = 4
const TONAL_PROMINENCE = 6
/** ...and at least this many must be present, otherwise it was a click/tap/rustle. */
const MIN_TONAL_PEAKS = 3
/** Peaks must also have grown at least this much since just before the onset (so a ringing note can't vouch for a click). */
const TONAL_GROWTH = 1.7
const SNAPSHOT_COUNT = 6
/** The flux peak lands ~3 ms before the true attack on synthetic piano (measured); shift later by this much. */
const ONSET_BIAS_SAMPLES = 140

/**
 * Streaming spectral analysis: feed it mono samples with `push()`. Each hop it
 *  - updates a per-bin noise floor,
 *  - computes a noise-relative, log-compressed spectral flux and picks onsets from it,
 *  - (optionally) computes multi-resolution magnitude spectra for the note verifier (PD-307).
 * Pure TypeScript with no DOM access, so it runs in a Web Worker.
 */
export class SpectralAnalyzer {
  readonly sampleRate: number
  readonly hop: number
  private readonly onsetSize: number
  private readonly bands: BandSpec[]
  private readonly withSpectra: boolean
  private readonly spectraEvery: number

  private readonly ring: Float32Array
  private readonly scratch: Float32Array
  private readonly maxWindow: number
  private pos = 0
  private filled = 0
  private consumed = 0 // total samples pushed
  private sinceHop = 0
  private origin = 0 // absolute index of the first sample ever pushed
  private started = false
  private hopCount = 0

  private readonly onsetSpectrum: SpectrumAnalyzer
  private readonly onsetMags: Float64Array
  private readonly onsetFloor: NoiseFloor
  private prevCompressed: Float64Array
  private readonly firstBin: number
  private readonly lastBin: number

  private readonly bandAnalyzers: SpectrumAnalyzer[]
  private readonly bandMags: Float64Array[]
  private readonly bandFloors: NoiseFloor[]

  // flux history for peak picking: [older, previous, current] plus window for the median
  private flux: number[] = []
  private ends: number[] = []
  private lastOnsetSample = -Infinity
  private pending: {
    onset: OnsetEvent
    confirmHop: number
    deadlineHop: number
    before: Float64Array[]
  }[] = []
  /** Recent copies of each band's spectrum, oldest first, used as the "before the onset" reference. */
  private snapshots: Float64Array[][] = []

  constructor(opts: AnalyzerOptions) {
    this.sampleRate = opts.sampleRate
    this.hop = opts.hop ?? 256
    this.onsetSize = opts.onsetFftSize ?? 1024
    this.bands = opts.bands ?? DEFAULT_BANDS
    this.withSpectra = opts.spectra ?? true
    this.spectraEvery = opts.spectraEvery ?? 2

    const maxSize = Math.max(this.onsetSize, ...this.bands.map((b) => b.fftSize))
    this.maxWindow = maxSize
    this.ring = new Float32Array(maxSize)
    this.scratch = new Float32Array(maxSize)

    this.onsetSpectrum = new SpectrumAnalyzer(this.onsetSize)
    this.onsetMags = new Float64Array(this.onsetSpectrum.binCount)
    this.onsetFloor = new NoiseFloor(this.onsetSpectrum.binCount)
    this.prevCompressed = new Float64Array(this.onsetSpectrum.binCount)
    const binHz = this.sampleRate / this.onsetSize
    this.firstBin = Math.max(1, Math.round(30 / binHz))
    this.lastBin = Math.min(this.onsetSpectrum.binCount - 1, Math.round(8000 / binHz))

    this.bandAnalyzers = this.bands.map((b) => new SpectrumAnalyzer(b.fftSize))
    this.bandMags = this.bandAnalyzers.map((a) => new Float64Array(a.binCount))
    this.bandFloors = this.bandAnalyzers.map((a) => new NoiseFloor(a.binCount))
  }

  /** Seed the noise floors from measured silence (calibration). Call `push` with silence instead if simpler. */
  reset(): void {
    this.filled = 0
    this.pos = 0
    this.consumed = 0
    this.sinceHop = 0
    this.started = false
    this.hopCount = 0
    this.flux = []
    this.ends = []
    this.lastOnsetSample = -Infinity
    this.pending = []
    this.snapshots = []
    this.prevCompressed.fill(0)
  }

  /**
   * Feed samples. `startSample` is the absolute index of `samples[0]` (as from the capture
   * worklet); a jump from the expected position resets the analyzer state.
   */
  push(samples: Float32Array, startSample?: number): AnalysisFrame[] {
    if (startSample !== undefined) {
      if (!this.started) this.origin = startSample
      else if (startSample !== this.origin + this.consumed) {
        this.reset()
        this.origin = startSample
      }
    }
    this.started = true
    const frames: AnalysisFrame[] = []
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.pos] = samples[i]
      this.pos = (this.pos + 1) % this.ring.length
      if (this.filled < this.ring.length) this.filled++
      this.consumed++
      if (++this.sinceHop === this.hop) {
        this.sinceHop = 0
        if (this.filled >= this.onsetSize) frames.push(this.step())
      }
    }
    return frames
  }

  private step(): AnalysisFrame {
    const endSample = this.origin + this.consumed - 1
    this.hopCount++
    const tail = this.latest(this.onsetSize)

    // --- onset flux ---
    this.onsetSpectrum.magnitudes(tail, this.onsetMags)
    const floor = this.onsetFloor.floor
    let flux = 0
    const mags = this.onsetMags
    const prev = this.prevCompressed
    const seeded = this.hopCount > 1
    for (let k = this.firstBin; k <= this.lastBin; k++) {
      const c = Math.log1p(mags[k] / (floor[k] + 1e-9))
      if (seeded && c > prev[k]) flux += c - prev[k]
      prev[k] = c
    }
    // First step seeds the floor with the first frame (assumed quiet); later steps track it.
    this.onsetFloor.update(mags)
    // Only now is `floor` valid for the very first frame; its compression above was against zeros.
    if (!seeded) prev.fill(0)

    this.pickCandidates(flux, endSample)

    // --- multi-resolution spectra (also keeps the per-band noise floors current) ---
    let spectra: BandSpectrum[] | undefined
    if (this.hopCount % this.spectraEvery === 0) {
      const out: BandSpectrum[] = []
      this.bands.forEach((band, i) => {
        if (this.filled >= band.fftSize) {
          this.bandAnalyzers[i].magnitudes(this.latest(band.fftSize), this.bandMags[i])
          this.bandFloors[i].update(this.bandMags[i])
        }
        out.push({
          band,
          binHz: this.sampleRate / band.fftSize,
          magnitudes: this.bandMags[i],
          noiseFloor: this.bandFloors[i].floor,
        })
      })
      if (this.withSpectra) spectra = out
      if (this.filled >= this.maxWindow) {
        this.snapshots.push(this.bandMags.map((m) => m.slice()))
        if (this.snapshots.length > SNAPSHOT_COUNT) this.snapshots.shift()
      }
    }

    // Candidates become onsets only if they turn out to be pitched.
    const confirmed: OnsetEvent[] = []
    this.pending = this.pending.filter((p) => {
      if (p.confirmHop > this.hopCount) return true
      // Retries (after the first check) are only for the newest candidate: if a newer one has
      // arrived, pitched energy now belongs to it, and this was a click shortly before a note.
      const isRetry = this.hopCount > p.confirmHop
      if (isRetry && this.pending.some((q) => q.onset.sample > p.onset.sample)) return false
      if (this.isPitched(p.before)) {
        confirmed.push(p.onset)
        this.lastOnsetSample = Math.max(this.lastOnsetSample, p.onset.sample)
        return false
      }
      return this.hopCount < p.deadlineHop // keep waiting, or give up
    })
    return { endSample, flux, onsets: confirmed, spectra }
  }

  /** The most recent `n` samples as one contiguous array (valid until the next call). */
  private latest(n: number): Float32Array {
    const out = this.scratch.subarray(0, n)
    const start = (this.pos - n + this.ring.length) % this.ring.length
    const firstPart = Math.min(n, this.ring.length - start)
    out.set(this.ring.subarray(start, start + firstPart), 0)
    out.set(this.ring.subarray(0, n - firstPart), firstPart)
    return out
  }

  private pickCandidates(flux: number, endSample: number): void {
    this.flux.push(flux)
    this.ends.push(endSample)
    const keep = FLUX_HISTORY + 3
    if (this.flux.length > keep) {
      this.flux.shift()
      this.ends.shift()
    }
    const n = this.flux.length
    if (n < 3 || this.hopCount < WARMUP_HOPS) return
    const [f0, f1, f2] = [this.flux[n - 3], this.flux[n - 2], this.flux[n - 1]]
    if (!(f1 > f0 && f1 >= f2)) return

    const window = this.flux.slice(0, n - 2).sort((a, b) => a - b)
    const median = window.length ? window[window.length >> 1] : 0
    if (f1 <= median * MEDIAN_MULTIPLIER + MIN_FLUX) return

    // Refine the peak position between hops with a parabola through the three flux values.
    const denom = f0 - 2 * f1 + f2
    const shift = denom === 0 ? 0 : (0.5 * (f0 - f2)) / denom
    const centre = this.ends[n - 2] - this.onsetSize / 2 + shift * this.hop
    const sample = centre + ONSET_BIAS_SAMPLES
    if (sample - this.lastOnsetSample < MIN_CONFIRMED_GAP_SEC * this.sampleRate) return
    const lastPending = Math.max(-Infinity, ...this.pending.map((p) => p.onset.sample))
    if (sample - lastPending < MIN_ONSET_GAP_SEC * this.sampleRate) return
    this.pending.push({
      onset: { sample, timeSec: sample / this.sampleRate, strength: f1 },
      confirmHop: this.hopCount + CONFIRM_DELAY_HOPS,
      deadlineHop: this.hopCount + CONFIRM_DEADLINE_HOPS,
      before: this.snapshots[0] ?? this.bandMags,
    })
  }

  /** True if the signal right now contains enough clearly pitched peaks (not just a click or rustle). */
  private isPitched(before: Float64Array[]): boolean {
    let peaks = 0
    for (let i = 0; i < this.bands.length; i++) {
      const band = this.bands[i]
      if (this.filled < band.fftSize) continue
      this.bandAnalyzers[i].magnitudes(this.latest(band.fftSize), this.bandMags[i])
      peaks += countTonalPeaks(
        this.bandMags[i],
        this.bandFloors[i].floor,
        this.sampleRate / band.fftSize,
        band.minHz,
        band.maxHz,
        TONAL_SNR,
        TONAL_PROMINENCE,
        before[i],
        TONAL_GROWTH,
      )
    }
    return peaks >= MIN_TONAL_PEAKS
  }
}
