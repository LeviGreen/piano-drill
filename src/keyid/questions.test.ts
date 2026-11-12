import { describe, expect, it } from 'vitest'
import { keyName, keySignature } from '../theory/keys'
import { formatPitch } from '../theory/pitch'
import { ledgerLines } from '../theory/staff'
import { answerLabel, shortLabel } from './labels'
import {
  answerSpace,
  checkAnswer,
  consistentAnswers,
  correctAnswer,
  DEFAULT_KEY_ID_CONFIG,
  formatFor,
  KeyIdGenerator,
  tonicMatches,
  type KeyIdConfig,
} from './questions'

const config = (c: Partial<KeyIdConfig>): KeyIdConfig => ({ ...DEFAULT_KEY_ID_CONFIG, ...c })
const take = (g: KeyIdGenerator, n: number) => Array.from({ length: n }, () => g.next())

describe('the format follows from the keys asked', () => {
  it('one mode asked: the signature alone names the key. Both modes: the tonic is shown too', () => {
    expect(formatFor('major')).toBe('major')
    expect(formatFor('minor')).toBe('minor')
    expect(formatFor('both')).toBe('key')
  })
})

describe('answer space', () => {
  it('has 15 answers for major only and 30 when minor is included, F♯ and G♭ always distinct', () => {
    expect(answerSpace('major')).toHaveLength(15)
    expect(answerSpace('key')).toHaveLength(30)
    const labels = answerSpace('major').map(answerLabel)
    expect(labels).toContain('F♯ major')
    expect(labels).toContain('G♭ major')
    expect(new Set(labels).size).toBe(15)
  })

  it('labels', () => {
    expect(answerLabel({ accidentals: -3, mode: 'major' })).toBe('E♭ major')
    expect(shortLabel({ accidentals: -3, mode: 'major' })).toBe('E♭')
    expect(shortLabel({ accidentals: 0, mode: 'minor' })).toBe('Am')
  })
})

describe('major-only questions', () => {
  it('show the signature alone and expect its major key', () => {
    const qs = take(new KeyIdGenerator(config({ maxAccidentals: 7, modes: 'major' }), 3), 200)
    for (const q of qs) {
      expect(q.format).toBe('major')
      expect(q.hint).toBeNull()
      expect(q.key.mode).toBe('major')
      expect(q.answer).toEqual({ accidentals: q.accidentals, mode: 'major' })
      expect(consistentAnswers(q)).toEqual([q.answer])
    }
  })

  it('stay within the accidental limit and cover every key up to it', () => {
    const qs = take(new KeyIdGenerator(config({ maxAccidentals: 2 }), 5), 300)
    expect(new Set(qs.map((q) => keyName(q.key)))).toEqual(
      new Set(['C major', 'G major', 'F major', 'D major', 'B♭ major']),
    )
  })
})

describe('questions that mix major and minor keys', () => {
  it('show the tonic as a whole note without ledger lines, and have exactly one right answer', () => {
    const qs = take(new KeyIdGenerator(config({ maxAccidentals: 7, modes: 'both' }), 9), 400)
    for (const q of qs) {
      expect(q.format).toBe('key')
      expect(q.hint).not.toBeNull()
      expect(ledgerLines(q.hint!, q.clef)).toBe(0)
      expect(q.answer).toEqual({ accidentals: q.accidentals, mode: q.key.mode })
      expect(consistentAnswers(q)).toEqual([q.answer])
    }
    expect(new Set(qs.map((q) => q.key.mode))).toEqual(new Set(['major', 'minor']))
  })

  it('minor only asks only minor keys, with no note on the staff (the signature alone names the key)', () => {
    const qs = take(new KeyIdGenerator(config({ modes: 'minor', maxAccidentals: 3 }), 2), 100)
    expect(qs.every((q) => q.key.mode === 'minor' && q.hint === null)).toBe(true)
    expect(qs.every((q) => q.format === 'minor' && q.answer.mode === 'minor')).toBe(true)
    for (const q of qs) expect(consistentAnswers(q)).toEqual([q.answer])
  })
})

describe('the clef is random, treble or bass, one at a time', () => {
  it.each(['major', 'minor', 'both'] as const)(
    '%s: both clefs come up, roughly evenly',
    (modes) => {
      const qs = take(new KeyIdGenerator(config({ modes, maxAccidentals: 7 }), 11), 600)
      const bass = qs.filter((q) => q.clef === 'bass').length
      expect(qs.every((q) => q.clef === 'treble' || q.clef === 'bass')).toBe(true)
      expect(bass).toBeGreaterThan(200)
      expect(bass).toBeLessThan(400)
    },
  )

  it('the tonic note shown with a minor/mixed question sits on the staff of its own clef, with no ledger lines', () => {
    const qs = take(new KeyIdGenerator(config({ modes: 'both', maxAccidentals: 7 }), 5), 600)
    for (const q of qs) {
      expect(ledgerLines(q.hint!, q.clef), `${q.clef} ${formatPitch(q.hint!)}`).toBe(0)
    }
    expect(new Set(qs.map((q) => q.clef))).toEqual(new Set(['treble', 'bass']))
  })

  it('has the same single right answer in either clef (the clef changes how it looks, not the answer)', () => {
    const qs = take(new KeyIdGenerator(config({ modes: 'both', maxAccidentals: 7 }), 8), 400)
    for (const q of qs) expect(consistentAnswers(q)).toEqual([q.answer])
  })
})

describe('generator', () => {
  it('never repeats a signature back to back (a major and its relative minor look the same)', () => {
    const qs = take(new KeyIdGenerator(config({ modes: 'both', maxAccidentals: 3 }), 4), 300)
    for (let i = 1; i < qs.length; i++) expect(qs[i].accidentals).not.toBe(qs[i - 1].accidentals)
  })

  it('is deterministic per seed', () => {
    const run = (seed: number) =>
      take(new KeyIdGenerator(config({ modes: 'both', maxAccidentals: 7 }), seed), 20).map(
        (q) => q.id + keyName(q.key) + (q.hint ? q.hint.midi : ''),
      )
    expect(run(8)).toEqual(run(8))
    expect(run(8)).not.toEqual(run(9))
  })

  it('works with a single key', () => {
    const q = new KeyIdGenerator(config({ maxAccidentals: 0, modes: 'major' })).next()
    expect(keyName(q.key)).toBe('C major')
    expect(new KeyIdGenerator(config({ maxAccidentals: 0, modes: 'major' })).next().id).toBe('k1')
  })
})

describe('checking answers', () => {
  const q = new KeyIdGenerator(config({ maxAccidentals: 7, modes: 'major' }), 1).next()

  it('F♯ major and G♭ major are different answers', () => {
    const fSharp = { accidentals: 6, mode: 'major' as const }
    const gFlat = { accidentals: -6, mode: 'major' as const }
    const fq = { ...q, accidentals: 6, key: keySignature(6, 'major'), answer: fSharp }
    expect(checkAnswer(fq, fSharp)).toBe(true)
    expect(checkAnswer(fq, gFlat)).toBe(false)
  })

  it('needs the right mode', () => {
    const a = q.answer
    expect(checkAnswer(q, a)).toBe(true)
    expect(checkAnswer(q, { ...a, mode: 'minor' })).toBe(false)
  })

  it('the correct answer for each format', () => {
    const a = keySignature(-3, 'minor')
    expect(correctAnswer('major', a)).toEqual({ accidentals: -3, mode: 'major' })
    expect(correctAnswer('key', a)).toEqual({ accidentals: -3, mode: 'minor' })
  })
})

describe('played answers', () => {
  const ask = (accidentals: number, mode: 'major' | 'minor') => {
    const key = keySignature(accidentals, mode)
    return {
      id: 'x',
      key,
      clef: 'treble' as const,
      accidentals,
      format: 'key' as const,
      hint: null,
      prompt: '',
      answer: { accidentals, mode },
    }
  }

  it('matches the tonic in any octave', () => {
    const q = ask(-3, 'major') // E♭
    for (const midi of [39, 51, 63, 75]) expect(tonicMatches(q, midi)).toBe(true)
    expect(tonicMatches(q, 64)).toBe(false) // E natural
  })

  it('F♯ and G♭ sound the same, so either is right when played', () => {
    expect(tonicMatches(ask(6, 'major'), 66)).toBe(true)
    expect(tonicMatches(ask(-6, 'major'), 66)).toBe(true)
  })
})
