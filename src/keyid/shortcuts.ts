import { findKey, type KeySignature } from '../theory/keys'
import type { Letter } from '../theory/pitch'
import type { KeyIdAnswer, KeyIdFormat } from './questions'

/**
 * Typing an answer. For key names: a letter A to G, then optionally # or b (sharp or flat), then optionally m
 * (minor), then Enter. "e b Enter" is E♭ major; "f # m Enter" is F♯ minor. For the signature format: a digit 0
 * to 7, then # or b: "3 b Enter" is 3 flats. A "b" with nothing pending is the note B; after a letter it means flat.
 */
export type Entry = {
  letter: Letter | null
  accidental: -1 | 0 | 1
  minor: boolean
  digit: number | null
  /** For the signature format: the sign typed after the digit. */
  sign: 'sharp' | 'flat' | null
}

export const EMPTY_ENTRY: Entry = {
  letter: null,
  accidental: 0,
  minor: false,
  digit: null,
  sign: null,
}

export type EntryResult = { entry: Entry; submit: boolean }

const LETTERS = 'abcdefg'

export function entryKey(entry: Entry, key: string, format: KeyIdFormat): EntryResult {
  const k = key.length === 1 ? key.toLowerCase() : key
  if (k === 'Enter' || k === ' ') return { entry, submit: true }
  if (k === 'Escape') return { entry: EMPTY_ENTRY, submit: false }
  if (k === 'Backspace') {
    if (format === 'signature') {
      if (entry.sign) return { entry: { ...entry, sign: null }, submit: false }
      return { entry: EMPTY_ENTRY, submit: false }
    }
    if (entry.minor) return { entry: { ...entry, minor: false }, submit: false }
    if (entry.accidental !== 0) return { entry: { ...entry, accidental: 0 }, submit: false }
    return { entry: EMPTY_ENTRY, submit: false }
  }

  if (format === 'signature') {
    if (/^[0-7]$/.test(k)) return { entry: { ...EMPTY_ENTRY, digit: Number(k) }, submit: false }
    if (entry.digit !== null && (k === '#' || k === '+'))
      return { entry: { ...entry, sign: 'sharp' }, submit: false }
    if (entry.digit !== null && (k === 'b' || k === '-'))
      return { entry: { ...entry, sign: 'flat' }, submit: false }
    return { entry, submit: false }
  }

  if (k === '#' || k === '+')
    return entry.letter
      ? { entry: { ...entry, accidental: 1 }, submit: false }
      : { entry, submit: false }
  if (k === '-')
    return entry.letter
      ? { entry: { ...entry, accidental: -1 }, submit: false }
      : { entry, submit: false }
  if (k === 'm' && format !== 'major')
    return entry.letter
      ? { entry: { ...entry, minor: !entry.minor }, submit: false }
      : { entry, submit: false }
  if (k === 'b' && entry.letter && entry.accidental === 0 && !entry.minor) {
    return { entry: { ...entry, accidental: -1 }, submit: false } // a flat, not the note B
  }
  if (k.length === 1 && LETTERS.includes(k))
    return { entry: { ...EMPTY_ENTRY, letter: k.toUpperCase() as Letter }, submit: false }
  return { entry, submit: false }
}

/** The key the typed letters name, or null (nothing typed yet, or no such key, such as D♯ major). */
export function entryKeySignature(entry: Entry): KeySignature | null {
  if (!entry.letter) return null
  return findKey(entry.letter, entry.accidental, entry.minor ? 'minor' : 'major')
}

/** What the typing means as an answer in this format, or null if it is not (yet) a valid answer. */
export function entryAnswer(entry: Entry, format: KeyIdFormat): KeyIdAnswer | null {
  if (format === 'signature') {
    if (entry.digit === null) return null
    if (entry.digit === 0) return { accidentals: 0 }
    if (!entry.sign) return null
    return { accidentals: entry.sign === 'sharp' ? entry.digit : -entry.digit }
  }
  const key = entryKeySignature(entry)
  if (!key) return null
  if (format === 'pair') return { accidentals: key.accidentals }
  if (format === 'major') return { accidentals: key.accidentals, mode: 'major' }
  return { accidentals: key.accidentals, mode: key.mode }
}

/** What to show while typing, e.g. "E♭ major", "3 flats…", or a hint when it is not a valid answer. */
export function entryText(entry: Entry, format: KeyIdFormat): string {
  const sym = { [-1]: '♭', 0: '', 1: '♯' } as const
  if (format === 'signature') {
    if (entry.digit === null) return ''
    if (entry.digit === 0) return 'No sharps or flats'
    if (!entry.sign) return `${entry.digit} … sharp (#) or flat (b)?`
    return `${entry.digit} ${entry.sign}${entry.digit > 1 ? 's' : ''}`
  }
  if (!entry.letter) return ''
  const name = `${entry.letter}${sym[entry.accidental]} ${entry.minor ? 'minor' : 'major'}`
  return entryKeySignature(entry) ? name : `${name}: no such key`
}
