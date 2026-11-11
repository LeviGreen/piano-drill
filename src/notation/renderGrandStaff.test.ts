import { beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_TWO_HAND_CONFIG, TwoHandGenerator } from '../theory/twoHand'
import { ALL_KEYS, keyName, keySignature, signaturePlacement } from '../theory/keys'
import { parsePitch, type Pitch } from '../theory/pitch'
import { staffPosition, type Clef } from '../theory/staff'
import { grandStaffSize, renderGrandStaff } from './renderGrandStaff'

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

type Note = string | Pitch
const toPitch = (n: Note): Pitch => (typeof n === 'string' ? parsePitch(n) : n)

const draw = (key = keySignature(0, 'major'), rh?: Note[], lh?: Note[], ledgerRoom?: number) => {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const handle = renderGrandStaff(div, {
    key,
    rh: rh?.map(toPitch),
    lh: lh?.map(toPitch),
    ledgerRoom,
  })
  return { div, handle }
}

const expectedSignature = (key: ReturnType<typeof keySignature>, clef: Clef) =>
  signaturePlacement(key, clef).map((p) => ({
    type: p.spelling.accidental === 1 ? '#' : 'b',
    line: (8 - staffPosition(p, clef)) / 2,
  }))

describe('grand staff renderer', () => {
  it('draws one SVG with a treble and a bass staff and a brace', () => {
    const { div, handle } = draw()
    expect(div.querySelectorAll('svg')).toHaveLength(1)
    expect(div.querySelectorAll('.vf-stave').length).toBe(2)
    expect(div.querySelectorAll('text').length).toBe(2) // the two clefs (the brace and barlines are drawn as paths)
    expect(handle.lineY.bassTop).toBeGreaterThan(handle.lineY.trebleBottom)
  })

  it('draws the right key signature on both staves for all 30 keys', () => {
    for (const key of ALL_KEYS) {
      const { handle } = draw(key)
      expect(handle.trebleSignature, `${keyName(key)} treble`).toEqual(
        expectedSignature(key, 'treble'),
      )
      expect(handle.bassSignature, `${keyName(key)} bass`).toEqual(expectedSignature(key, 'bass'))
    }
  })

  it('aligns right- and left-hand notes on the same x', () => {
    const { handle } = draw(undefined, ['E4', 'G4', 'C5'], ['C3', 'G3'])
    expect(handle.noteX.rh).toBeDefined()
    expect(Math.abs(handle.noteX.rh! - handle.noteX.lh!)).toBeLessThan(0.5)
  })

  it('draws notes on the correct staff', () => {
    const { div } = draw(undefined, ['E4', 'G4'], ['C3'])
    expect(div.querySelectorAll('.vf-notehead')).toHaveLength(3)
  })

  it('works with only one hand, or no notes', () => {
    expect(() => draw(undefined, ['C5'])).not.toThrow()
    expect(() => draw(undefined, undefined, ['C3'])).not.toThrow()
    expect(draw(undefined, undefined, undefined).div.querySelectorAll('.vf-notehead')).toHaveLength(
      0,
    )
  })

  it('keeps the same size and staff positions whatever is drawn (no layout jump between reps)', () => {
    const a = draw(keySignature(0, 'major'), ['E4'], ['C3']).handle
    const b = draw(keySignature(-5, 'major'), ['C4', 'E4', 'G4', 'C5'], ['G2', 'D3']).handle
    const empty = draw(keySignature(6, 'major')).handle
    for (const h of [b, empty]) {
      expect(h.size).toEqual(a.size)
      expect(h.lineY).toEqual(a.lineY)
    }
  })

  it('leaves the same margin above the treble staff as below the bass staff, growing with ledger room', () => {
    for (const ledgerRoom of [1, 2, 3]) {
      const { handle } = draw(undefined, ['C4'], ['C4'], ledgerRoom)
      const size = grandStaffSize(ledgerRoom)
      expect(handle.lineY.trebleTop).toBe(size.margin)
      expect(handle.size.height - handle.lineY.bassBottom).toBe(size.margin)
      expect(handle.lineY.bassTop - handle.lineY.trebleBottom).toBe(size.gap)
    }
  })

  it('shows accidentals per staff, relative to the key', () => {
    const { handle } = draw(keySignature(0, 'major'), ['F#4', 'A4'], ['F#2'])
    expect(handle.noteAccidentals.rh).toEqual(['#'])
    expect(handle.noteAccidentals.lh).toEqual(['#'])
    const inD = draw(keySignature(2, 'major'), ['F#4'], ['F#2']).handle
    expect(inD.noteAccidentals).toEqual({ rh: [], lh: [] })
  })

  it('renders generated two-hand targets in every key without throwing, with the hands aligned', () => {
    for (const key of ALL_KEYS) {
      const g = new TwoHandGenerator(
        {
          ...DEFAULT_TWO_HAND_CONFIG,
          keys: [key],
          chordSizes: ['triad', 'seventh'],
          minorForm: 'either',
          maxSameKeyRun: 99,
        },
        3,
      )
      for (let i = 0; i < 25; i++) {
        const t = g.next()
        const { handle } = draw(key, t.parts[1].pitches, t.parts[0].pitches)
        expect(Math.abs(handle.noteX.rh! - handle.noteX.lh!), keyName(key)).toBeLessThan(0.5)
      }
    }
  }, 60_000)
})
