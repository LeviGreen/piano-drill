import { describe, expect, it } from 'vitest'
import { validateTarget } from '../theory/constraints'
import { keyName } from '../theory/keys'
import { ledgerLines } from '../theory/staff'
import { createLevelGenerator, keysFor, toGeneratorConfigs } from './levelGenerator'
import { levelById, PRESET_LEVELS } from './presets'
import { constraintsFor, parseSettings } from './settings'

describe('the 10 preset levels', () => {
  it('there are 10, numbered 1 to 10, each validating with no warnings', () => {
    expect(PRESET_LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (const l of PRESET_LEVELS) {
      const r = parseSettings(l.settings)
      expect(r.ok, l.name).toBe(true)
      expect(r.ok && r.warnings).toEqual([])
      expect(l.settings.goal).toBeDefined()
    }
  })

  it('keeps every level inside the MVP range G2 to F5', () => {
    for (const l of PRESET_LEVELS) {
      expect(l.settings.range).toEqual({ low: 'G2', high: 'F5' })
      expect(l.settings.ledgerLines).toBeLessThanOrEqual(1)
    }
  })

  it('gets steadily harder: more keys, then more notes, then two hands', () => {
    const acc = PRESET_LEVELS.map((l) => l.settings.keys.maxAccidentals)
    expect(acc).toEqual([0, 1, 2, 3, 3, 4, 2, 4, 5, 7])
    const goals = PRESET_LEVELS.map((l) => l.settings.goal!.medianSeconds)
    for (let i = 1; i < goals.length; i++) expect(goals[i]).toBeGreaterThanOrEqual(goals[i - 1])
    expect(PRESET_LEVELS.slice(0, 6).every((l) => !l.settings.hands.includes('both'))).toBe(true)
    expect(
      PRESET_LEVELS.slice(6, 9).every(
        (l) => l.settings.hands.length === 1 && l.settings.hands[0] === 'both',
      ),
    ).toBe(true)
  })

  it('matches the design table', () => {
    expect(levelById(1).settings).toMatchObject({
      hands: ['RH'],
      notesPerHand: [1],
      keys: { maxAccidentals: 0, modes: 'major' },
    })
    expect(keysFor(levelById(1).settings).map(keyName)).toEqual(['C major']) // "C only"
    expect(levelById(2).settings.hands).toEqual(['RH', 'LH'])
    expect(levelById(3).settings.intervalSizes).toEqual([2, 3, 4, 5]) // 2nds to 5ths
    expect(levelById(4).settings.notesPerHand).toEqual([2])
    expect(levelById(5).settings.inversions).toBe(false) // root position
    expect(levelById(6).settings.inversions).toBe(true)
    expect(keysFor(levelById(10).settings)).toHaveLength(30) // all keys
  })

  it('throws for a level that does not exist', () => {
    expect(() => levelById(11)).toThrow(RangeError)
  })
})

describe('any valid settings can drive the generators', () => {
  it.each(PRESET_LEVELS.map((l) => [l.name, l] as const))(
    '%s: 300 valid targets that match its settings',
    (_n, level) => {
      const s = level.settings
      const g = createLevelGenerator(s, 5)
      const c = constraintsFor(s)
      const keys = new Set(keysFor(s).map(keyName))
      for (let i = 0; i < 300; i++) {
        const t = g.next()
        expect(validateTarget(t, c).ok, `${level.name}: ${t.id}`).toBe(true)
        expect(keys.has(keyName(t.key))).toBe(true)
        if (t.parts.length === 2) {
          expect(s.hands).toContain('both')
          // Each hand gets a note count from the level's list, same as in one-hand mode.
          for (const part of t.parts) expect(s.notesPerHand).toContain(part.pitches.length)
        } else {
          const hand = t.parts[0].hand
          expect(s.hands).toContain(hand)
          const n = t.parts[0].pitches.length
          expect(n).toBeLessThanOrEqual(4)
          if (!s.inversions) expect(t.content.inversion ?? 0).toBe(0)
        }
      }
    },
  )

  it('level 10 mixes one-hand and two-hand targets', () => {
    const g = createLevelGenerator(levelById(10).settings, 3)
    const counts = { one: 0, two: 0 }
    for (let i = 0; i < 400; i++) {
      if (g.next().parts.length === 2) counts.two++
      else counts.one++
    }
    expect(counts.one).toBeGreaterThan(100)
    expect(counts.two).toBeGreaterThan(100)
  })

  it('level 1 never goes beyond the staff (no ledger lines) and uses only the right hand', () => {
    const g = createLevelGenerator(levelById(1).settings, 2)
    for (let i = 0; i < 200; i++) {
      const t = g.next()
      expect(t.parts[0].hand).toBe('RH')
      for (const p of t.parts[0].pitches) expect(ledgerLines(p, 'treble')).toBe(0) // middle C (C4) would need one
    }
  })

  it('splits settings into the right generator configs', () => {
    const one = toGeneratorConfigs(levelById(2).settings)
    expect(one.single).not.toBeNull()
    expect(one.two).toBeNull()
    const both = toGeneratorConfigs(levelById(7).settings)
    expect(both.single).toBeNull()
    expect(both.two?.notesPerHand).toEqual([1, 2]) // the same list as for one hand
  })

  it('is deterministic per seed', () => {
    const run = (seed: number) => {
      const g = createLevelGenerator(levelById(9).settings, seed)
      return Array.from({ length: 20 }, () => g.next().id + g.next().parts.length)
    }
    expect(run(4)).toEqual(run(4))
  })
})
