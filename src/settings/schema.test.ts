import { describe, expect, it } from 'vitest'
import { deepMerge, isInt } from './json'
import { loadPresets, presetById } from './presets'
import { checkGoal, checkName, checkTimeout, checkVersionOnly, createSettings } from './schema'

/** A made-up mode, to show that a new mode needs only a schema. */
type Toy = { version: number; name: string; timeoutSeconds: number | null; size: number }
const toy = createSettings<Toy>({
  knownKeys: new Set(['version', 'name', 'timeoutSeconds', 'size']),
  defaults: { version: 1, name: 'Custom', timeoutSeconds: 10, size: 3 },
  migrate: checkVersionOnly(1),
  validate: (s) => {
    const errors: string[] = []
    checkName(s, errors)
    checkTimeout(s, errors)
    if (!isInt(s.size, 1, 9)) errors.push('size: must be 1 to 9')
    return errors
  },
})

describe('createSettings', () => {
  it('fills missing fields from the defaults', () => {
    const r = toy.parse({ size: 5 })
    expect(r).toEqual({
      ok: true,
      settings: { version: 1, name: 'Custom', timeoutSeconds: 10, size: 5 },
      warnings: [],
    })
  })

  it('drops unknown keys with a warning', () => {
    const r = toy.parse({ extra: 1 })
    if (!r.ok) throw new Error('expected ok')
    expect(r.warnings).toEqual(['extra: unknown setting, ignored'])
    expect('extra' in r.settings).toBe(false)
  })

  it('reports every problem, naming the field', () => {
    const r = toy.parse({ name: '', timeoutSeconds: 500, size: 99 })
    expect(r).toEqual({
      ok: false,
      errors: [
        'name: must be 1 to 60 characters (got "")',
        'timeoutSeconds: must be null (no timeout) or a number from 1 to 120 (got 500)',
        'size: must be 1 to 9',
      ],
    })
  })

  it('refuses a newer version and anything that is not an object', () => {
    expect(toy.parse({ version: 2 })).toEqual({
      ok: false,
      errors: ['version: 2 is not understood by this app (it knows up to 1)'],
    })
    expect(toy.parse([])).toEqual({ ok: false, errors: ['settings: must be a JSON object'] })
  })

  it('merge overlays fields onto a base and checks the result', () => {
    const base = toy.parse({}) as { ok: true; settings: Toy }
    const r = toy.merge(base.settings, { size: 7 })
    expect(r.ok && r.settings.size).toBe(7)
    expect(toy.merge(base.settings, { size: 0 }).ok).toBe(false)
    expect(toy.merge(base.settings, 5)).toEqual({
      ok: false,
      errors: ['overrides: must be a JSON object'],
    })
  })
})

describe('shared checks', () => {
  it('checkGoal accepts a good goal and names each bad part', () => {
    const errors: string[] = []
    checkGoal({ goal: { medianSeconds: 2, accuracy: 0.9, reps: 20 } }, 'x', errors)
    checkGoal({}, 'x', errors)
    expect(errors).toEqual([])
    checkGoal({ goal: { medianSeconds: 0, accuracy: 2, reps: 0 } }, 'x', errors)
    expect(errors.map((e) => e.split(':')[0])).toEqual([
      'goal.medianSeconds',
      'goal.accuracy',
      'goal.reps',
    ])
    checkGoal({ goal: 5 }, '{ "a": 1 }', errors)
    expect(errors.at(-1)).toBe('goal: must be an object like { "a": 1 }')
  })

  it('deepMerge merges objects and replaces lists and values', () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, l: [1, 2] }, { a: { b: 9 }, l: [3] })).toEqual({
      a: { b: 9, c: 2 },
      l: [3],
    })
  })
})

describe('presets', () => {
  const parse = (s: unknown) => toy.parse(s)
  const data = [{ id: 1, name: 'One', description: 'first', settings: { size: 2 } }]

  it('loads and looks levels up by id', () => {
    const levels = loadPresets(data, parse, 'toy.json')
    expect(levels[0].settings.size).toBe(2)
    expect(presetById(levels, 1).name).toBe('One')
    expect(() => presetById(levels, 2, 'toy level')).toThrow('No toy level 2')
  })

  it('fails with the file and level when a preset is invalid', () => {
    const bad = [{ ...data[0], settings: { size: 99 } }]
    expect(() => loadPresets(bad, parse, 'toy.json')).toThrow(/toy\.json, level 1:\s+size: must be/)
  })
})
