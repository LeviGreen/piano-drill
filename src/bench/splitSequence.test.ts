import { describe, expect, it } from 'vitest'
import { renderNotes } from '../test-utils/synthPiano'
import {
  isSequence,
  mergeOnsets,
  onsetTimes,
  parseSequenceToken,
  planSegments,
} from './splitSequence'

describe('sequence labels', () => {
  it('reads a note and an optional remark', () => {
    expect(parseSequenceToken('G2')).toEqual({ names: ['G2'], remark: null })
    expect(parseSequenceToken('C4@soft')).toEqual({ names: ['C4'], remark: 'soft' })
  })

  it('reads notes played together, joined with +', () => {
    expect(parseSequenceToken('C4+E4+G4@loud')).toEqual({
      names: ['C4', 'E4', 'G4'],
      remark: 'loud',
    })
  })

  it('knows a sequence from an ordinary take', () => {
    expect(isSequence('single', ['C4', 'E4'])).toBe(true) // one note at a time
    expect(isSequence('single', ['C4'])).toBe(false)
    expect(isSequence('interval', ['C4+E4', 'D3+A3'])).toBe(true)
    expect(isSequence('interval', ['C4', 'G4'])).toBe(false) // a single interval played together
    expect(isSequence('triad', ['C4', 'E4', 'G4'])).toBe(false)
  })
})

describe('merging onsets', () => {
  it('treats starts within 1.5 s as one note, and sorts them', () => {
    expect(mergeOnsets([9.0, 1.0, 1.4, 5.0, 5.2, 5.3])).toEqual([1.0, 5.0, 9.0])
  })
})

describe('planning the cuts', () => {
  it('cuts each note with room tone before and its decay after, without touching its neighbours', () => {
    const r = planSegments([2, 6.5, 11], 3, 15)
    if (!r.ok) throw new Error(r.error)
    expect(r.segments).toEqual([
      { onsetSec: 2, startSec: 0.5, endSec: 4.5 },
      { onsetSec: 6.5, startSec: 5, endSec: 9 },
      { onsetSec: 11, startSec: 9.5, endSec: 13.5 },
    ])
    for (let i = 1; i < r.segments.length; i++)
      expect(r.segments[i].startSec).toBeGreaterThanOrEqual(r.segments[i - 1].endSec - 1e-9)
  })

  it('trims the first and last clip to the recording', () => {
    const r = planSegments([0.5, 5], 2, 6)
    if (!r.ok) throw new Error(r.error)
    expect(r.segments[0].startSec).toBe(0)
    expect(r.segments[1].endSec).toBe(6)
  })

  it('with the minimum rest each clip still holds its own note and nothing of the next', () => {
    const r = planSegments([2, 5], 2, 9)
    if (!r.ok) throw new Error(r.error)
    expect(r.segments[0].endSec).toBeLessThan(5)
    expect(r.segments[1].startSec).toBeGreaterThan(2)
  })

  it('ignores sounds after the last listed note (such as the click of Stop), and keeps them out of the last clip', () => {
    const r = planSegments([2, 6.5, 8.4], 2, 10)
    if (!r.ok) throw new Error(r.error)
    expect(r.segments).toHaveLength(2)
    expect(r.ignored).toEqual([8.4])
    expect(r.segments[1].endSec).toBeCloseTo(7.9)
  })

  it('still fails when too few notes were found, even with extras', () => {
    expect(planSegments([2], 2, 10).ok).toBe(false)
  })

  it('says how many notes it found when that is not the number in the label', () => {
    const r = planSegments([2, 6], 3, 10)
    expect(!r.ok && r.error).toMatch(/Found 2 notes but the label lists 3.*2\.0 s, 6\.0 s/)
    const none = planSegments([], 2, 10)
    expect(!none.ok && none.error).toMatch(/Found 0 notes.*none/)
  })

  it('refuses notes played too close together, and says where', () => {
    const r = planSegments([2, 4], 2, 10)
    expect(!r.ok && r.error).toMatch(/Notes 1 and 2 are only 2\.0 s apart/)
  })
})

describe('a whole sequence take, end to end', () => {
  it('finds the notes in a synthetic take, one every 4.5 s, and plans a clean cut for each', () => {
    const SR = 48000
    const starts = [1.5, 6, 10.5, 15]
    const midis = [43, 59, 66, 77] // G2, B3, F#4, F5
    const samples = renderNotes(
      midis.map((midi, i) => ({ midi, start: starts[i], duration: 2 })),
      { sampleRate: SR, length: 19, noiseDb: -60, seed: 7 },
    )
    const found = mergeOnsets(onsetTimes(samples, SR))
    expect(found).toHaveLength(4)
    found.forEach((t, i) => expect(Math.abs(t - starts[i])).toBeLessThan(0.1))
    const plan = planSegments(found, 4, 19)
    expect(plan.ok).toBe(true)
  })
})
