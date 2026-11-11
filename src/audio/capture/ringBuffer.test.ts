import { describe, expect, it } from 'vitest'
import { RingBuffer } from './ringBuffer'

const seq = (from: number, n: number) => Float32Array.from({ length: n }, (_, i) => from + i)

describe('RingBuffer', () => {
  it('reads back what was written, by absolute frame', () => {
    const r = new RingBuffer(8)
    r.write(seq(0, 5))
    expect([...r.read(1, 3)!]).toEqual([1, 2, 3])
    expect(r.totalWritten).toBe(5)
    expect(r.oldestFrame).toBe(0)
  })

  it('wraps around correctly', () => {
    const r = new RingBuffer(8)
    r.write(seq(0, 6))
    r.write(seq(6, 6)) // frames 6..11, wraps
    expect(r.oldestFrame).toBe(4)
    expect([...r.read(4, 8)!]).toEqual([4, 5, 6, 7, 8, 9, 10, 11])
    expect([...r.read(9, 3)!]).toEqual([9, 10, 11])
  })

  it('returns null for frames that are overwritten or not yet written', () => {
    const r = new RingBuffer(4)
    r.write(seq(0, 10))
    expect(r.read(5, 2)).toBeNull() // overwritten
    expect(r.read(8, 3)).toBeNull() // future
    expect(r.read(6, 4)).not.toBeNull()
  })

  it('keeps only the tail when a single write exceeds capacity', () => {
    const r = new RingBuffer(4)
    r.write(seq(0, 10))
    expect([...r.read(6, 4)!]).toEqual([6, 7, 8, 9])
    expect(r.totalWritten).toBe(10)
  })

  it('latest() returns the most recent frames, fewer if not enough yet', () => {
    const r = new RingBuffer(8)
    r.write(seq(0, 3))
    expect([...r.latest(5)]).toEqual([0, 1, 2])
    r.write(seq(3, 10))
    expect([...r.latest(3)]).toEqual([10, 11, 12])
  })

  it('handles many small writes (like 512-sample batches) across wraps', () => {
    const r = new RingBuffer(2000)
    for (let i = 0; i < 20; i++) r.write(seq(i * 512, 512))
    const got = r.read(20 * 512 - 100, 100)!
    expect(got[0]).toBe(20 * 512 - 100)
    expect(got[99]).toBe(20 * 512 - 1)
  })
})
