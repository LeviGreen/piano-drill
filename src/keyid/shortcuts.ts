import { findKey, type KeySignature } from '../theory/keys'
import type { Letter } from '../theory/pitch'
import type { KeyIdAnswer, KeyIdFormat } from './questions'

/**
 * Typing an answer: a letter A to G, then optionally # (or 3, the same key without Shift) or b (sharp or flat), then optionally m (minor), then Enter.
 * "e b Enter" is E♭ major; "f # m Enter" is F♯ minor. A "b" with nothing pending is the note B; after a letter it means
 * flat. When only one mode is asked, "m" does nothing: the mode is already known.
 */
export type Entry = {
  letter: Letter | null
  accidental: -1 | 0 | 1
  minor: boolean
}

export const EMPTY_ENTRY: Entry = { letter: null, accidental: 0, minor: false }

export type EntryResult = { entry: Entry; submit: boolean }

const LETTERS = 'abcdefg'

export function entryKey(entry: Entry, key: string, format: KeyIdFormat): EntryResult {
  const k = key.length === 1 ? key.toLowerCase() : key
  if (k === 'Enter' || k === ' ') return { entry, submit: true }
  if (k === 'Escape') return { entry: EMPTY_ENTRY, submit: false }
  if (k === 'Backspace') {
    if (entry.minor && format === 'key') return { entry: { ...entry, minor: false }, submit: false }
    if (entry.accidental !== 0) return { entry: { ...entry, accidental: 0 }, submit: false }
    return { entry: EMPTY_ENTRY, submit: false }
  }
  if (k === '#' || k === '+' || k === '3')
    // 3 is # without Shift
    return entry.letter
      ? { entry: { ...entry, accidental: 1 }, submit: false }
      : { entry, submit: false }
  if (k === '-')
    return entry.letter
      ? { entry: { ...entry, accidental: -1 }, submit: false }
      : { entry, submit: false }
  if (k === 'm' && format === 'key')
    return entry.letter
      ? { entry: { ...entry, minor: !entry.minor }, submit: false }
      : { entry, submit: false }
  if (k === 'b' && entry.letter && entry.accidental === 0 && (!entry.minor || format === 'minor')) {
    return { entry: { ...entry, accidental: -1 }, submit: false } // a flat, not the note B
  }
  if (k.length === 1 && LETTERS.includes(k))
    return {
      entry: { ...EMPTY_ENTRY, letter: k.toUpperCase() as Letter, minor: format === 'minor' },
      submit: false,
    }
  return { entry, submit: false }
}

/** The key the typed letters name, or null (nothing typed yet, or no such key, such as D♯ major). */
export function entryKeySignature(entry: Entry): KeySignature | null {
  if (!entry.letter) return null
  return findKey(entry.letter, entry.accidental, entry.minor ? 'minor' : 'major')
}

/** What the typing means as an answer, or null if it is not (yet) a valid answer. */
export function entryAnswer(entry: Entry): KeyIdAnswer | null {
  const key = entryKeySignature(entry)
  return key ? { accidentals: key.accidentals, mode: key.mode } : null
}

/** What to show while typing, e.g. "E♭ major", or a note when it is not a key. */
export function entryText(entry: Entry): string {
  if (!entry.letter) return ''
  const sym = { [-1]: '♭', 0: '', 1: '♯' } as const
  const name = `${entry.letter}${sym[entry.accidental]} ${entry.minor ? 'minor' : 'major'}`
  return entryKeySignature(entry) ? name : `${name}: no such key`
}
