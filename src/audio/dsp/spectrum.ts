import { FFT } from './fft'

/** Periodic Hann window (the right choice for spectral analysis). */
export function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n)
  return w
}

/**
 * Windowed magnitude spectrum of the most recent `fftSize` samples. Magnitudes are scaled so a
 * sine wave of amplitude A shows up as roughly A at its peak bin.
 */
export class SpectrumAnalyzer {
  readonly fftSize: number
  readonly binCount: number
  private readonly fft: FFT
  private readonly window: Float64Array
  private readonly re: Float64Array
  private readonly im: Float64Array
  private readonly scale: number

  constructor(fftSize: number) {
    this.fftSize = fftSize
    this.binCount = fftSize / 2 + 1
    this.fft = new FFT(fftSize)
    this.window = hannWindow(fftSize)
    this.re = new Float64Array(fftSize)
    this.im = new Float64Array(fftSize)
    this.scale = 2 / this.window.reduce((a, b) => a + b, 0)
  }

  /** `frame` must hold exactly `fftSize` samples. Writes `binCount` magnitudes into `out`. */
  magnitudes(frame: ArrayLike<number>, out: Float64Array): void {
    const { re, im, window, fftSize } = this
    for (let i = 0; i < fftSize; i++) {
      re[i] = frame[i] * window[i]
      im[i] = 0
    }
    this.fft.forward(re, im)
    for (let k = 0; k < this.binCount; k++) out[k] = Math.hypot(re[k], im[k]) * this.scale
  }
}

export type SpectralPeak = { freqHz: number; magnitude: number; bin: number }

const EPS = 1e-12

/** Refine a local maximum at bin k by fitting a parabola through the log magnitudes. */
export function interpolatePeak(mags: ArrayLike<number>, k: number, binHz: number): SpectralPeak {
  const a = Math.log(mags[k - 1] + EPS)
  const b = Math.log(mags[k] + EPS)
  const c = Math.log(mags[k + 1] + EPS)
  const denom = a - 2 * b + c
  const p = denom === 0 ? 0 : (0.5 * (a - c)) / denom
  return { freqHz: (k + p) * binHz, magnitude: Math.exp(b - 0.25 * (a - c) * p), bin: k }
}

/**
 * Local maxima between minHz and maxHz whose magnitude exceeds `threshold[k]` (e.g. a multiple of
 * the noise floor), with parabolic frequency/magnitude refinement.
 */
export function findPeaks(
  mags: ArrayLike<number>,
  binHz: number,
  threshold: ArrayLike<number>,
  minHz = 20,
  maxHz = Infinity,
): SpectralPeak[] {
  const lo = Math.max(1, Math.ceil(minHz / binHz))
  const hi = Math.min(mags.length - 2, Math.floor(maxHz / binHz))
  const peaks: SpectralPeak[] = []
  for (let k = lo; k <= hi; k++) {
    if (mags[k] > mags[k - 1] && mags[k] >= mags[k + 1] && mags[k] > threshold[k]) {
      peaks.push(interpolatePeak(mags, k, binHz))
    }
  }
  return peaks
}

/**
 * Count clearly pitched peaks: local maxima that are `snr` times above the noise floor AND
 * `prominence` times above the median of their surroundings. Piano partials are sharp and prominent;
 * clicks, taps and rustles are smooth or noise-like and produce (almost) none.
 */
export function countTonalPeaks(
  mags: ArrayLike<number>,
  floor: ArrayLike<number>,
  binHz: number,
  minHz: number,
  maxHz: number,
  snr: number,
  prominence: number,
  /** Spectrum from just before the onset: only peaks that grew by `growth` times count. */
  before?: ArrayLike<number>,
  growth = 1,
): number {
  const lo = Math.max(3, Math.ceil(minHz / binHz))
  const hi = Math.min(mags.length - 2, Math.floor(maxHz / binHz))
  const neighbours: number[] = []
  let count = 0
  for (let k = lo; k <= hi; k++) {
    if (!(mags[k] > mags[k - 1] && mags[k] >= mags[k + 1] && mags[k] > floor[k] * snr)) continue
    neighbours.length = 0
    for (let j = Math.max(1, k - 12); j <= Math.min(mags.length - 1, k + 12); j++) {
      if (Math.abs(j - k) > 2) neighbours.push(mags[j])
    }
    neighbours.sort((a, b) => a - b)
    const median = neighbours[neighbours.length >> 1] ?? 0
    if (mags[k] < prominence * median) continue
    if (before) {
      const was = Math.max(before[k - 1], before[k], before[k + 1])
      if (mags[k] < growth * was) continue
    }
    count++
  }
  return count
}
