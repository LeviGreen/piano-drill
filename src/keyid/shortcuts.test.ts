import { describe, expect, it } from 'vitest'
import { ALL_KEYS, keyName } from '../theory/keys'
import type { KeyIdFormat } from './questions'
import { EMPTY_ENTRY, entryAnswer, entryKey, entryText, type Entry } from './shortcuts'

/** Type a sequence of keys; returns the final entry and whether Enter was pressed at the end. */
function type(keys: string[], format: KeyIdFormat): { entry: Entry; submitted: boolean } {
  let entry = EMPTY_ENTRY
  let submitted = false
  for (const k of keys) {
    const r = entryKey(entry, k, format)
    entry = r.entry
    submitted = r.submit
  }
  return { entry, submitted }
}

/** The keys to press for a key: "Eb major" -> e, b, Enter; "F# minor" -> f, #, m, Enter. */
function keysFor(key: (typeof ALL_KEYS)[number]): string[] {
  const seq = [key.tonic.letter.toLowerCase()]
  if (key.tonic.accidental === 1) seq.push('#')
  if (key.tonic.accidental === -1) seq.push('b')
  if (key.mode === 'minor') seq.push('m')
  return [...seq, 'Enter']
}

describe('typing a key name', () => {
  it('reaches all 30 keys when minor keys are included (acceptance)', () => {
    for (const key of ALL_KEYS) {
      const { entry, submitted } = type(keysFor(key), 'key')
      expect(submitted, keyName(key)).toBe(true)
      expect(entryAnswer(entry), keyName(key)).toEqual({
        accidentals: key.accidentals,
        mode: key.mode,
      })
    }
  })

  it('reaches all 15 major keys when only major keys are asked', () => {
    for (const key of ALL_KEYS.filter((k) => k.mode === 'major')) {
      expect(entryAnswer(type(keysFor(key), 'major').entry)).toEqual({
        accidentals: key.accidentals,
        mode: 'major',
      })
    }
  })

  it('treats "b" as the note B when nothing is typed, and as a flat after a letter', () => {
    expect(entryAnswer(type(['b'], 'major').entry)).toEqual({ accidentals: 5, mode: 'major' }) // B major
    expect(entryAnswer(type(['b', 'b'], 'major').entry)).toEqual({
      accidentals: -2,
      mode: 'major',
    }) // B-flat major
    expect(entryAnswer(type(['e', 'b'], 'major').entry)).toEqual({
      accidentals: -3,
      mode: 'major',
    }) // E-flat major
  })

  it('accepts + and - as sharp and flat, in either case', () => {
    expect(entryAnswer(type(['F', '+'], 'major').entry)).toEqual({ accidentals: 6, mode: 'major' })
    expect(entryAnswer(type(['g', '-'], 'major').entry)).toEqual({ accidentals: -6, mode: 'major' })
  })

  it('treats 3 as a sharp, so it works without holding Shift', () => {
    expect(entryAnswer(type(['f', '3'], 'major').entry)).toEqual({ accidentals: 6, mode: 'major' })
    expect(entryAnswer(type(['g', '3', 'm'], 'key').entry)).toEqual({
      accidentals: 5,
      mode: 'minor',
    })
    expect(type(['3'], 'major').entry).toEqual(EMPTY_ENTRY) // nothing to sharpen yet
  })

  it('F♯ and G♭ are different answers', () => {
    expect(entryAnswer(type(['f', '#'], 'major').entry)).not.toEqual(
      entryAnswer(type(['g', 'b'], 'major').entry),
    )
  })

  it('reaches all 15 minor keys when only minor keys are asked, with no m needed', () => {
    for (const key of ALL_KEYS.filter((k) => k.mode === 'minor')) {
      const keys = keysFor(key).filter((k) => k !== 'm')
      expect(entryAnswer(type(keys, 'minor').entry), keyName(key)).toEqual({
        accidentals: key.accidentals,
        mode: 'minor',
      })
    }
    expect(entryText(type(['e', 'b'], 'minor').entry)).toBe('E♭ minor')
  })

  it('ignores "m" when only major keys are asked', () => {
    expect(type(['a', 'm'], 'major').entry.minor).toBe(false)
  })

  it('says when typing names a key that does not exist, and gives no answer', () => {
    // D♯, G♯ and A♯ major would need more than 7 sharps
    for (const keys of [
      ['d', '#'],
      ['g', '#'],
      ['a', '#'],
    ]) {
      const { entry } = type(keys, 'key')
      expect(entryAnswer(entry)).toBeNull()
      expect(entryText(entry)).toMatch(/no such key/)
    }
    expect(entryAnswer(type(['d', '#', 'm'], 'key').entry)).toEqual({
      accidentals: 6,
      mode: 'minor',
    }) // D♯ minor is fine
  })

  it('a new letter starts again; Backspace removes the last part; Escape clears', () => {
    expect(entryAnswer(type(['e', 'b', 'c'], 'major').entry)).toEqual({
      accidentals: 0,
      mode: 'major',
    }) // C: not E♭C
    expect(entryAnswer(type(['e', 'b', 'Backspace'], 'major').entry)).toEqual({
      accidentals: 4,
      mode: 'major',
    }) // back to E
    expect(entryAnswer(type(['a', 'm', 'Backspace'], 'key').entry)).toEqual({
      accidentals: 3,
      mode: 'major',
    }) // back to A major
    expect(type(['a', 'Backspace'], 'key').entry).toEqual(EMPTY_ENTRY)
    expect(type(['a', 'Escape'], 'key').entry).toEqual(EMPTY_ENTRY)
  })

  it('does nothing for keys that mean nothing, and Space also submits', () => {
    expect(type(['x', '9', '#'], 'key').entry).toEqual(EMPTY_ENTRY)
    expect(type(['c', ' '], 'major').submitted).toBe(true)
    expect(entryAnswer(EMPTY_ENTRY)).toBeNull()
  })

  it('shows readable text while typing', () => {
    expect(entryText(type(['e', 'b'], 'major').entry)).toBe('E♭ major')
    expect(entryText(type(['f', '#', 'm'], 'key').entry)).toBe('F♯ minor')
    expect(entryText(EMPTY_ENTRY)).toBe('')
  })
})
