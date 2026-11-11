import { describe, expect, it } from 'vitest'
import { decodeWav, encodeWav } from './wav'

describe('WAV', () => {
  it('round-trips 16-bit mono within quantisation error', () => {
    const x = Float32Array.from({ length: 1000 }, (_, i) => 0.8 * Math.sin(i / 7))
    const back = decodeWav(encodeWav(x, 44100))
    expect(back.sampleRate).toBe(44100)
    expect(back.samples).toHaveLength(1000)
    for (let i = 0; i < x.length; i++)
      expect(Math.abs(back.samples[i] - x[i])).toBeLessThan(1 / 16000)
  })

  it('clips out-of-range samples instead of wrapping', () => {
    const back = decodeWav(encodeWav(Float32Array.of(2, -2), 8000))
    expect(back.samples[0]).toBeGreaterThan(0.99)
    expect(back.samples[1]).toBeLessThan(-0.99)
  })

  it('rejects non-WAV data', () => {
    expect(() => decodeWav(new Uint8Array(64))).toThrow(SyntaxError)
  })
})
