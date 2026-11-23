import { describe, expect, it } from 'vitest'
import { validateTarget } from '../theory/constraints'
import { keyName } from '../theory/keys'
import { ledgerLines } from '../theory/staff'
import { createLevelGenerator, keysFor, toGeneratorConfigs } from './levelGenerator'
import { levelById, PRESET_LEVELS } from './presets'
import { constraintsFor, parseSettings } from './settings'

describe('the 10 preset levels', () => {
  it('level 9 has only 3 or 4 notes per hand, and its description says so', () => {
    expect(levelById(9).settings.notesPerHand).toEqual([3, 4])
    expect(levelById(9).description).toMatch(/three or four notes/)
  })

  it('level 8 has no single-note targets (2 or 3 notes per hand), and its description says so', () => {
    expect(levelById(8).settings.notesPerHand).toEqual([2, 3])
    expect(levelById(8).description).toMatch(/two or three notes/)
  })

  it('there are 10, numbered 1 to 10, each validating with no warnings', () => {
    expect(PRESET_LEVELS.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    for (const l of PRESET_LEVELS) {
      const r = parseSettings(l.settings)
      expect(r.ok, l.name).toBe(true)
      expect(r.ok && r.warnings).toEqual([])
      expect(l.settings.goal).toBeDefined()
    }
  })

  it('every level uses the range C2 to C6: one ledger line for levels 1 and 2, two for levels 3 to 10', () => {
    for (const l of PRESET_LEVELS) {
      expect(l.settings.range).toEqual({ low: 'C2', high: 'C6' })
      expect(l.settings.ledgerLines, l.name).toBe(l.id <= 2 ? 1 : 2)
    }
  })

  it('gets steadily harder: more keys, then more notes, then two hands', () => {
    const acc = PRESET_LEVELS.map((l) => l.settings.keys.maxAccidentals)
    expect(acc).toEqual([0, 1, 2, 3, 3, 4, 2, 4, 5, 5])
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

  it('level 10 is level 9 with only 5 seconds for each target', () => {
    const { name: _n, timeoutSeconds, ...ten } = levelById(10).settings
    const { name: _n9, timeoutSeconds: nine, ...nineRest } = levelById(9).settings
    expect(ten).toEqual(nineRest)
    expect(timeoutSeconds).toBe(5)
    expect(nine).not.toBe(5)
  })

  it('levels 1 and 2 stay within one ledger line of each staff, and use it', () => {
    for (const id of [1, 2]) {
      const g = createLevelGenerator(levelById(id).settings, 2)
      let usedLedger = false
      for (let i = 0; i < 600; i++) {
        const t = g.next()
        for (const part of t.parts)
          for (const p of part.pitches) {
            const n = ledgerLines(p, part.clef)
            expect(n, `level ${id}`).toBeLessThanOrEqual(1)
            if (n === 1) usedLedger = true
          }
      }
      expect(usedLedger, `level ${id} never used a ledger line`).toBe(true)
    }
    const l1 = createLevelGenerator(levelById(1).settings, 2)
    for (let i = 0; i < 100; i++) expect(l1.next().parts[0].hand).toBe('RH')
  })

  it('levels 3 to 10 use up to two ledger lines past the treble and bass staves, in both clefs', () => {
    for (let id = 3; id <= 10; id++) {
      const g = createLevelGenerator(levelById(id).settings, 6)
      const seen = { treble: 0, bass: 0 }
      let lowest = Infinity
      let highest = -Infinity
      for (let i = 0; i < 1500; i++) {
        for (const part of g.next().parts)
          for (const p of part.pitches) {
            const n = ledgerLines(p, part.clef)
            expect(n, `level ${id}`).toBeLessThanOrEqual(2)
            if (n === 2) seen[part.clef]++
            lowest = Math.min(lowest, p.midi)
            highest = Math.max(highest, p.midi)
          }
      }
      expect(seen.treble, `level ${id}: no 2-ledger-line treble notes`).toBeGreaterThan(0)
      expect(seen.bass, `level ${id}: no 2-ledger-line bass notes`).toBeGreaterThan(0)
      expect(lowest, `level ${id}`).toBeGreaterThanOrEqual(36) // C2
      expect(highest, `level ${id}`).toBeLessThanOrEqual(84) // C6
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
