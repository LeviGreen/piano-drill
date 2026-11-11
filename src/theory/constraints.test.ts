import { describe, expect, it } from 'vitest'
import { DEFAULT_CONSTRAINTS, handSpan, validatePart, validateTarget } from './constraints'
import { keySignature } from './keys'
import { parsePitch } from './pitch'
import { ledgerLines, staffPosition } from './staff'
import type { HandPart, Hand, Target } from './target'

const ps = (...names: string[]) => names.map(parsePitch)
const part = (hand: Hand, clef: 'treble' | 'bass', ...names: string[]): HandPart => ({
  hand,
  clef,
  pitches: ps(...names),
})
const target = (...parts: HandPart[]): Target => ({
  id: 't',
  key: keySignature(0, 'major'),
  parts,
  content: { type: 'triad' },
})
const codes = (t: Target, c = DEFAULT_CONSTRAINTS) =>
  validateTarget(t, c).reasons.map((r) => r.code)

describe('staff positions and ledger lines', () => {
  it('treble clef: lines E4..F5, ledger lines outside', () => {
    expect(staffPosition(parsePitch('E4'), 'treble')).toBe(0)
    expect(staffPosition(parsePitch('F5'), 'treble')).toBe(8)
    const l = (n: string) => ledgerLines(parsePitch(n), 'treble')
    expect([l('E4'), l('F5'), l('G5'), l('D4')]).toEqual([0, 0, 0, 0]) // on staff or in the space beside it
    expect([l('C4'), l('B3'), l('A3'), l('A5'), l('B5'), l('C6')]).toEqual([1, 1, 2, 1, 1, 2])
  })

  it('bass clef: lines G2..A3, ledger lines outside', () => {
    const l = (n: string) => ledgerLines(parsePitch(n), 'bass')
    expect([l('G2'), l('A3'), l('F2'), l('B3')]).toEqual([0, 0, 0, 0])
    expect([l('E2'), l('C2'), l('A1'), l('C4'), l('E4')]).toEqual([1, 2, 3, 1, 2])
  })

  it('accidentals do not change where a note is drawn', () => {
    expect(ledgerLines(parsePitch('C#4'), 'treble')).toBe(ledgerLines(parsePitch('Cb4'), 'treble'))
  })
})

describe('hand span', () => {
  it('measures lowest to highest in semitones', () => {
    expect(handSpan(part('RH', 'treble', 'C4'))).toBe(0)
    expect(handSpan(part('RH', 'treble', 'C4', 'E4', 'G4'))).toBe(7)
    expect(handSpan({ pitches: [] })).toBe(0)
  })
})

describe('one-hand targets', () => {
  it('accepts a plain triad in treble clef', () => {
    expect(validateTarget(target(part('RH', 'treble', 'C4', 'E4', 'G4')))).toEqual({
      ok: true,
      reasons: [],
    })
  })

  it('rejects too many notes, empty parts and duplicate pitches', () => {
    expect(codes(target(part('RH', 'treble', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4')))).toContain(
      'too-many-notes',
    )
    expect(codes(target(part('RH', 'treble')))).toEqual(['empty-part'])
    expect(codes(target(part('RH', 'treble', 'C4', 'C4')))).toContain('duplicate-pitch')
    expect(codes(target(part('RH', 'treble', 'C4', 'B#3')))).toContain('duplicate-pitch') // same key
  })

  it('enforces the hand span: a 9th is fine, a 10th is not (default)', () => {
    expect(codes(target(part('RH', 'treble', 'C4', 'D5')))).toEqual([]) // 14 semitones
    expect(codes(target(part('RH', 'treble', 'C4', 'E5')))).toContain('span-too-wide') // 16
    expect(
      codes(target(part('RH', 'treble', 'C4', 'E5')), {
        ...DEFAULT_CONSTRAINTS,
        maxSpanSemitones: 16,
      }),
    ).toEqual([])
  })

  // Wider than the MVP defaults, for testing the individual rules.
  const WIDE = { ...DEFAULT_CONSTRAINTS, lowestMidi: 0, highestMidi: 127, maxLedgerLines: 3 }

  it('enforces the ledger-line limit per clef', () => {
    const two = { ...WIDE, maxLedgerLines: 2 }
    expect(codes(target(part('RH', 'treble', 'A3', 'C4')), two)).toEqual([]) // 2 ledger lines
    expect(codes(target(part('RH', 'treble', 'F3')), two)).toContain('ledger-lines') // 3 ledger lines
    expect(codes(target(part('RH', 'treble', 'C4')), { ...WIDE, maxLedgerLines: 0 })).toContain(
      'ledger-lines',
    )
    expect(codes(target(part('LH', 'bass', 'C2')), two)).toEqual([]) // 2 below
    expect(codes(target(part('LH', 'bass', 'A1')), two)).toContain('ledger-lines') // 3 below
  })

  it('MVP defaults: range G2 to F5, with middle C allowed in both clefs', () => {
    expect(codes(target(part('RH', 'treble', 'C4')))).toEqual([])
    expect(codes(target(part('LH', 'bass', 'C4')))).toEqual([])
    expect(codes(target(part('RH', 'treble', 'F5')))).toEqual([])
    expect(codes(target(part('LH', 'bass', 'G2')))).toEqual([])
    expect(codes(target(part('RH', 'treble', 'F#5')))).toContain('out-of-range')
    expect(codes(target(part('LH', 'bass', 'F#2')))).toContain('out-of-range')
    expect(codes(target(part('LH', 'bass', 'C2')))).toContain('out-of-range')
  })

  it('flags muddy low intervals but allows wide ones and anything above C3', () => {
    expect(codes(target(part('LH', 'bass', 'C2', 'E2')), WIDE)).toContain('low-interval') // third below C3
    expect(codes(target(part('LH', 'bass', 'C2', 'G2')), WIDE)).toEqual([]) // fifth is fine
    expect(codes(target(part('LH', 'bass', 'C3', 'E3')), WIDE)).toEqual([]) // not below C3
    expect(codes(target(part('LH', 'bass', 'C2', 'G2', 'D3')), WIDE)).toEqual([])
    expect(codes(target(part('LH', 'bass', 'G2', 'A2')))).toContain('low-interval') // inside the MVP range
  })

  it('reports every reason, not just the first', () => {
    const r = validateTarget(target(part('RH', 'treble', 'C3', 'D3', 'E3', 'F3', 'G3', 'E4')))
    expect(r.ok).toBe(false)
    expect(r.reasons.map((x) => x.code)).toEqual(
      expect.arrayContaining(['too-many-notes', 'span-too-wide', 'ledger-lines']),
    )
    expect(r.reasons.every((x) => x.message.length > 0)).toBe(true)
  })
})

describe('two-hand targets', () => {
  it('accepts LH below RH', () => {
    expect(
      validateTarget(target(part('LH', 'bass', 'C3'), part('RH', 'treble', 'E4', 'G4', 'C5'))).ok,
    ).toBe(true)
  })

  it('rejects hand crossing, including touching on the same key', () => {
    expect(codes(target(part('LH', 'bass', 'C4'), part('RH', 'treble', 'B3', 'D4')))).toContain(
      'hand-crossing',
    )
    expect(codes(target(part('LH', 'bass', 'G3'), part('RH', 'treble', 'G3', 'B3')))).toContain(
      'hand-crossing',
    )
  })

  it('allows crossing when configured', () => {
    expect(
      codes(target(part('LH', 'bass', 'C4'), part('RH', 'treble', 'B3', 'D4')), {
        ...DEFAULT_CONSTRAINTS,
        allowHandCrossing: true,
      }),
    ).not.toContain('hand-crossing')
  })

  it('rejects wrong part counts and the same hand twice', () => {
    expect(codes(target())).toContain('part-count')
    expect(codes(target(part('RH', 'treble', 'C4'), part('RH', 'treble', 'E4')))).toContain(
      'duplicate-hand',
    )
    expect(
      codes(
        target(part('RH', 'treble', 'C4'), part('LH', 'bass', 'C3'), part('RH', 'treble', 'E4')),
      ),
    ).toContain('part-count')
  })

  it('tags each violation with the hand it came from', () => {
    const r = validatePart(part('LH', 'bass', 'C2', 'E2'))
    expect(r.every((v) => v.hand === 'LH')).toBe(true)
  })
})
