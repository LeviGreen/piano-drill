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
  it('reaches all 30 keys in the "key" format (acceptance)', () => {
    for (const key of ALL_KEYS) {
      const { entry, submitted } = type(keysFor(key), 'key')
      expect(submitted, keyName(key)).toBe(true)
      expect(entryAnswer(entry, 'key'), keyName(key)).toEqual({
        accidentals: key.accidentals,
        mode: key.mode,
      })
    }
  })

  it('reaches all 15 major keys in the "major" format, and all 15 pairs by major or minor name', () => {
    for (const key of ALL_KEYS.filter((k) => k.mode === 'major')) {
      expect(entryAnswer(type(keysFor(key), 'major').entry, 'major')).toEqual({
        accidentals: key.accidentals,
        mode: 'major',
      })
    }
    for (const key of ALL_KEYS) {
      expect(entryAnswer(type(keysFor(key), 'pair').entry, 'pair'), keyName(key)).toEqual({
        accidentals: key.accidentals,
      })
    }
  })

  it('treats "b" as the note B when nothing is typed, and as a flat after a letter', () => {
    expect(entryAnswer(type(['b'], 'major').entry, 'major')).toEqual({
      accidentals: 5,
      mode: 'major',
    }) // B major
    expect(entryAnswer(type(['b', 'b'], 'major').entry, 'major')).toEqual({
      accidentals: -2,
      mode: 'major',
    }) // B-flat major
    expect(entryAnswer(type(['e', 'b'], 'major').entry, 'major')).toEqual({
      accidentals: -3,
      mode: 'major',
    }) // E-flat major
  })

  it('accepts + and - as sharp and flat, in either case', () => {
    expect(entryAnswer(type(['F', '+'], 'major').entry, 'major')).toEqual({
      accidentals: 6,
      mode: 'major',
    })
    expect(entryAnswer(type(['g', '-'], 'major').entry, 'major')).toEqual({
      accidentals: -6,
      mode: 'major',
    })
  })

  it('ignores "m" in the "major" format, and a minor mark cannot be typed where it is not wanted', () => {
    const { entry } = type(['a', 'm'], 'major')
    expect(entry.minor).toBe(false)
  })

  it('says when typing names a key that does not exist, and gives no answer', () => {
    for (const keys of [
      ['d', '#'],
      ['g', '#'],
      ['a', '#'],
      ['d', '#', 'm', 'm', 'm'],
    ]) {
      const { entry } = type(keys, 'key')
      // D♯ major, G♯ major and A♯ major do not exist (more than 7 sharps)
      if (keys.length === 2) {
        expect(entryAnswer(entry, 'key')).toBeNull()
        expect(entryText(entry, 'key')).toMatch(/no such key/)
      }
    }
    expect(entryAnswer(type(['d', '#', 'm'], 'key').entry, 'key')).toEqual({
      accidentals: 6,
      mode: 'minor',
    }) // D♯ minor is fine
  })

  it('a new letter starts again; Backspace removes the last part; Escape clears', () => {
    expect(entryAnswer(type(['e', 'b', 'c'], 'major').entry, 'major')).toEqual({
      accidentals: 0,
      mode: 'major',
    }) // C: not E♭C
    expect(entryAnswer(type(['e', 'b', 'Backspace'], 'major').entry, 'major')).toEqual({
      accidentals: 4,
      mode: 'major',
    }) // back to E
    expect(entryAnswer(type(['a', 'm', 'Backspace'], 'key').entry, 'key')).toEqual({
      accidentals: 3,
      mode: 'major',
    }) // back to A major
    expect(type(['a', 'Backspace'], 'key').entry).toEqual(EMPTY_ENTRY)
    expect(type(['a', 'Escape'], 'key').entry).toEqual(EMPTY_ENTRY)
  })

  it('does nothing for keys that mean nothing, and Space also submits', () => {
    expect(type(['x', '9', '#'], 'key').entry).toEqual(EMPTY_ENTRY)
    expect(type(['c', ' '], 'major').submitted).toBe(true)
    expect(entryAnswer(EMPTY_ENTRY, 'major')).toBeNull()
  })

  it('shows readable text while typing', () => {
    expect(entryText(type(['e', 'b'], 'major').entry, 'major')).toBe('E♭ major')
    expect(entryText(type(['f', '#', 'm'], 'key').entry, 'key')).toBe('F♯ minor')
    expect(entryText(EMPTY_ENTRY, 'key')).toBe('')
  })
})

describe('typing a signature', () => {
  it('reaches every count from 7 flats to 7 sharps', () => {
    for (let n = -7; n <= 7; n++) {
      const keys = n === 0 ? ['0', 'Enter'] : [String(Math.abs(n)), n > 0 ? '#' : 'b', 'Enter']
      const { entry, submitted } = type(keys, 'signature')
      expect(submitted).toBe(true)
      expect(entryAnswer(entry, 'signature'), String(n)).toEqual({ accidentals: n })
    }
  })

  it('needs a sign for any digit above 0, and shows a prompt', () => {
    const { entry } = type(['3'], 'signature')
    expect(entryAnswer(entry, 'signature')).toBeNull()
    expect(entryText(entry, 'signature')).toMatch(/sharp \(#\) or flat \(b\)\?/)
    expect(entryText(type(['3', 'b'], 'signature').entry, 'signature')).toBe('3 flats')
    expect(entryText(type(['1', '#'], 'signature').entry, 'signature')).toBe('1 sharp')
  })

  it('ignores 8 and 9, letters and a sign with no digit', () => {
    expect(type(['8'], 'signature').entry).toEqual(EMPTY_ENTRY)
    expect(type(['e'], 'signature').entry).toEqual(EMPTY_ENTRY)
    expect(type(['#'], 'signature').entry).toEqual(EMPTY_ENTRY)
  })
})
