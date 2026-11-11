import { describe, expect, it } from 'vitest'
import { FFT } from './fft'
import { findPeaks, interpolatePeak, SpectrumAnalyzer } from './spectrum'
import { NoiseFloor } from './noiseFloor'

function sine(freq: number, n: number, sr: number, amp = 1): Float32Array {
  return Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / sr))
}

describe('FFT', () => {
  it('matches a naive DFT', () => {
    const n = 16
    const x = Array.from({ length: n }, (_, i) => Math.sin(i * 0.7) + 0.3 * Math.cos(i * 2.1))
    const re = Float64Array.from(x)
    const im = new Float64Array(n)
    new FFT(n).forward(re, im)
    for (let k = 0; k < n; k++) {
      let sr = 0
      let si = 0
      for (let t = 0; t < n; t++) {
        sr += x[t] * Math.cos((2 * Math.PI * k * t) / n)
        si -= x[t] * Math.sin((2 * Math.PI * k * t) / n)
      }
      expect(re[k]).toBeCloseTo(sr, 9)
      expect(im[k]).toBeCloseTo(si, 9)
    }
  })

  it('rejects sizes that are not powers of two', () => {
    expect(() => new FFT(1000)).toThrow(RangeError)
  })
})

describe('magnitude spectrum and peak interpolation', () => {
  it('reports a sine of amplitude A as about A at its peak', () => {
    const sa = new SpectrumAnalyzer(4096)
    const mags = new Float64Array(sa.binCount)
    sa.magnitudes(sine(1000, 4096, 48000, 0.5), mags)
    const k = mags.indexOf(Math.max(...mags))
    expect(mags[k]).toBeGreaterThan(0.4)
    expect(mags[k]).toBeLessThan(0.55)
  })

  it('recovers off-bin frequencies to well under a bin using parabolic interpolation', () => {
    const sr = 48000
    const sa = new SpectrumAnalyzer(8192)
    const binHz = sr / 8192 // 5.86 Hz
    const mags = new Float64Array(sa.binCount)
    for (const f of [110.3, 261.63, 440, 1234.5, 3000.7]) {
      sa.magnitudes(sine(f, 8192, sr), mags)
      const k = mags.indexOf(Math.max(...mags))
      const peak = interpolatePeak(mags, k, binHz)
      expect(Math.abs(peak.freqHz - f)).toBeLessThan(0.1 * binHz)
    }
  })

  it('findPeaks returns the partials of a chord above a threshold', () => {
    const sr = 48000
    const sa = new SpectrumAnalyzer(8192)
    const mags = new Float64Array(sa.binCount)
    const a = sine(220, 8192, sr)
    const b = sine(330, 8192, sr)
    sa.magnitudes(
      a.map((v, i) => v + b[i]),
      mags,
    )
    const thr = new Float64Array(sa.binCount).fill(0.1)
    const peaks = findPeaks(mags, sr / 8192, thr, 50, 1000)
    expect(peaks.map((p) => Math.round(p.freqHz))).toEqual([220, 330])
  })
})

describe('NoiseFloor', () => {
  it('adopts the first frame, falls to quieter frames at once and rises only slowly', () => {
    const nf = new NoiseFloor(2, 1.01)
    nf.update([1, 4])
    expect([...nf.floor]).toEqual([1, 4])
    nf.update([0.5, 4])
    expect(nf.floor[0]).toBe(0.5)
    nf.update([100, 100])
    expect(nf.floor[0]).toBeCloseTo(0.505)
    expect(nf.floor[1]).toBeCloseTo(4.04)
  })

  it('can be seeded from a silence measurement', () => {
    const nf = new NoiseFloor(2)
    nf.seed([0.01, 0.02])
    nf.update([5, 5])
    expect(nf.floor[0]).toBeLessThan(0.02)
  })
})
