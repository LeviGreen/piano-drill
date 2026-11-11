import { describe, expect, it } from 'vitest'
import { keyName, keySignature } from '../theory/keys'
import { ledgerLines } from '../theory/staff'
import { answerLabel, signatureLabel } from './labels'
import {
  answerSpace,
  checkAnswer,
  consistentAnswers,
  correctAnswer,
  DEFAULT_KEY_ID_CONFIG,
  enharmonicAccidentals,
  KeyIdGenerator,
  type KeyIdConfig,
  type KeyIdFormat,
} from './questions'

const FORMATS: KeyIdFormat[] = ['signature', 'major', 'key', 'pair']
const config = (over: Partial<KeyIdConfig> = {}): KeyIdConfig => ({
  ...DEFAULT_KEY_ID_CONFIG,
  ...over,
})
const take = (c: KeyIdConfig, n: number, seed = 3) => {
  const g = new KeyIdGenerator(c, seed)
  return Array.from({ length: n }, () => g.next())
}

describe('every question has exactly one right answer (acceptance)', () => {
  for (const format of FORMATS) {
    it(`format "${format}": one answer fits what is drawn, and it is the stored answer`, () => {
      const questions = take(config({ format, maxAccidentals: 7, modes: 'both' }), 3000)
      for (const q of questions) {
        const fits = consistentAnswers(q)
        expect(fits, `${keyName(q.key)} ${format}`).toHaveLength(1)
        expect(fits[0]).toEqual(q.answer)
        expect(checkAnswer(q, q.answer, 'strict')).toBe(true)
      }
    })
  }

  it('the "key" format needs the tonic hint: without it a signature fits both a major and a minor key', () => {
    const q = take(config({ format: 'key', modes: 'major', maxAccidentals: 3 }), 1)[0]
    const withoutHint = { ...q, hint: null }
    expect(consistentAnswers(withoutHint)).toHaveLength(0) // no hint, no way to tell
    // Same drawn signature, answer space includes both: only the tonic tells them apart.
    const both = answerSpace('key').filter((a) => a.accidentals === q.accidentals)
    expect(both.map((a) => a.mode).sort()).toEqual(['major', 'minor'])
  })

  it('every one of the 30 keys appears as a question in the "key" format, each with its own tonic', () => {
    const seen = new Set(
      take(config({ format: 'key', maxAccidentals: 7, modes: 'both' }), 4000).map((q) =>
        keyName(q.key),
      ),
    )
    expect(seen.size).toBe(30)
  })
})

describe('the tonic hint', () => {
  const qs = take(config({ format: 'key', maxAccidentals: 7, modes: 'both' }), 2000)

  it("is the key's tonic, spelled correctly, in the staff with no ledger lines", () => {
    for (const q of qs) {
      expect(q.hint).not.toBeNull()
      expect(q.hint!.spelling.letter).toBe(q.key.tonic.letter)
      expect(q.hint!.spelling.accidental).toBe(q.key.tonic.accidental)
      expect(ledgerLines(q.hint!, q.clef)).toBe(0)
    }
  })

  it('only exists in the "key" format', () => {
    for (const format of ['signature', 'major', 'pair'] as const) {
      for (const q of take(config({ format }), 50)) expect(q.hint).toBeNull()
    }
  })
})

describe('what is asked for each format', () => {
  it('gives the stored answer shape for each format', () => {
    const eb = keySignature(-3, 'major')
    const cm = keySignature(-3, 'minor')
    expect(correctAnswer('signature', eb)).toEqual({ accidentals: -3 })
    expect(correctAnswer('major', cm)).toEqual({ accidentals: -3, mode: 'major' }) // a minor signature asks for its relative major
    expect(correctAnswer('key', cm)).toEqual({ accidentals: -3, mode: 'minor' })
    expect(correctAnswer('pair', eb)).toEqual({ accidentals: -3 })
  })

  it('offers the right number of answers: 15, 15, 30, 15', () => {
    expect(answerSpace('signature')).toHaveLength(15)
    expect(answerSpace('major')).toHaveLength(15)
    expect(answerSpace('key')).toHaveLength(30)
    expect(answerSpace('pair')).toHaveLength(15)
  })

  it('has a prompt for each', () => {
    for (const format of FORMATS)
      expect(take(config({ format }), 1)[0].prompt.length).toBeGreaterThan(5)
  })
})

describe('checking answers: enharmonic strictness', () => {
  const q = (accidentals: number, format: KeyIdFormat) => {
    const key = keySignature(accidentals, 'major')
    return {
      id: 'x',
      clef: 'treble' as const,
      key,
      accidentals,
      format,
      hint: null,
      prompt: '',
      answer: correctAnswer(format, key),
    }
  }

  it('maps each signature to its enharmonic twin, where one exists', () => {
    expect(enharmonicAccidentals(6)).toBe(-6) // F# major <-> Gb major
    expect(enharmonicAccidentals(-5)).toBe(7) // Db major <-> C# major
    expect(enharmonicAccidentals(5)).toBe(-7) // B major <-> Cb major
    expect(enharmonicAccidentals(0)).toBeNull()
    expect(enharmonicAccidentals(3)).toBeNull()
  })

  it('strict: F♯ major and G♭ major are different answers', () => {
    expect(checkAnswer(q(6, 'major'), { accidentals: 6, mode: 'major' }, 'strict')).toBe(true)
    expect(checkAnswer(q(6, 'major'), { accidentals: -6, mode: 'major' }, 'strict')).toBe(false)
  })

  it('lenient: the enharmonic key also counts, but other keys never do', () => {
    expect(checkAnswer(q(6, 'major'), { accidentals: -6, mode: 'major' }, 'lenient')).toBe(true)
    expect(checkAnswer(q(6, 'major'), { accidentals: -5, mode: 'major' }, 'lenient')).toBe(false)
    expect(checkAnswer(q(2, 'signature'), { accidentals: 2 }, 'lenient')).toBe(true)
    expect(checkAnswer(q(2, 'signature'), { accidentals: -10 + 12 }, 'lenient')).toBe(true) // same number
    expect(checkAnswer(q(2, 'signature'), { accidentals: 3 }, 'lenient')).toBe(false)
  })

  it('the "major" and "key" formats also need the right mode', () => {
    const minor = {
      ...q(0, 'key'),
      key: keySignature(0, 'minor'),
      answer: { accidentals: 0, mode: 'minor' as const },
    }
    expect(checkAnswer(minor, { accidentals: 0, mode: 'minor' }, 'strict')).toBe(true)
    expect(checkAnswer(minor, { accidentals: 0, mode: 'major' }, 'strict')).toBe(false)
    expect(checkAnswer(q(1, 'major'), { accidentals: 1, mode: 'minor' }, 'strict')).toBe(false)
  })
})

describe('generation', () => {
  it('stays within the accidental range and modes', () => {
    for (const q of take(config({ maxAccidentals: 3, modes: 'minor' }), 500)) {
      expect(Math.abs(q.accidentals)).toBeLessThanOrEqual(3)
      expect(q.key.mode).toBe('minor')
    }
    for (const q of take(config({ maxAccidentals: 0, modes: 'major' }), 20))
      expect(keyName(q.key)).toBe('C major')
  })

  it('never asks the same signature twice in a row (a major key and its relative minor count as the same)', () => {
    const qs = take(config({ maxAccidentals: 2, modes: 'both' }), 3000)
    for (let i = 1; i < qs.length; i++) expect(qs[i].accidentals).not.toBe(qs[i - 1].accidentals)
  })

  it('still works when only one signature is possible', () => {
    const qs = take(config({ maxAccidentals: 0, modes: 'both' }), 20) // C major / A minor share a signature
    expect(qs).toHaveLength(20)
  })

  it('uses the clefs given, and both when both are allowed', () => {
    expect(new Set(take(config({ clefs: ['bass'] }), 100).map((q) => q.clef))).toEqual(
      new Set(['bass']),
    )
    expect(new Set(take(config({ clefs: ['treble', 'bass'] }), 200).map((q) => q.clef)).size).toBe(
      2,
    )
  })

  it('uses all the keys roughly evenly', () => {
    const qs = take(config({ maxAccidentals: 7, modes: 'both', format: 'major' }), 15_000)
    const counts = new Map<string, number>()
    for (const q of qs) counts.set(keyName(q.key), (counts.get(keyName(q.key)) ?? 0) + 1)
    expect(counts.size).toBe(30)
    for (const [k, c] of counts) {
      expect(c, k).toBeGreaterThan((15_000 / 30) * 0.7)
      expect(c, k).toBeLessThan((15_000 / 30) * 1.3)
    }
  })

  it('is deterministic per seed, numbers its questions, and rejects bad settings', () => {
    const sig = (seed: number) =>
      take(config({ format: 'key' }), 30, seed).map((q) => `${keyName(q.key)}${q.clef}`)
    expect(sig(5)).toEqual(sig(5))
    expect(sig(5)).not.toEqual(sig(6))
    expect(take(config(), 3).map((q) => q.id)).toEqual(['k1', 'k2', 'k3'])
    expect(() => new KeyIdGenerator(config({ clefs: [] }))).toThrow(RangeError)
  })
})

describe('labels', () => {
  it('reads signatures and answers in plain words', () => {
    expect(signatureLabel(0)).toBe('No sharps or flats')
    expect(signatureLabel(1)).toBe('1 sharp')
    expect(signatureLabel(-3)).toBe('3 flats')
    expect(answerLabel({ accidentals: -3, mode: 'major' }, 'major')).toBe('E♭ major')
    expect(answerLabel({ accidentals: 3, mode: 'minor' }, 'key')).toBe('F♯ minor')
    expect(answerLabel({ accidentals: -3 }, 'pair')).toBe('E♭ major / C minor')
    expect(answerLabel({ accidentals: 6 }, 'signature')).toBe('6 sharps')
  })
})
