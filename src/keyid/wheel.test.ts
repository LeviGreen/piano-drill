import { describe, expect, it } from 'vitest'
import { ALL_KEYS, keyName } from '../theory/keys'
import { labelPoint, labelRotation, sectorPath, wheelPosition, wheelSectors, WHEEL } from './wheel'

describe('wheel geometry', () => {
  const sectors = wheelSectors()

  it('has one sector for each of the 30 keys, with their full names', () => {
    expect(sectors).toHaveLength(30)
    expect(new Set(sectors.map((s) => s.name))).toEqual(new Set(ALL_KEYS.map(keyName)))
  })

  it('puts the keys in circle-of-fifths order around the clock, C at the top', () => {
    const at = (name: string) => sectors.find((s) => s.name === name)!
    const mid = (s: { from: number; to: number }) => (s.from + s.to) / 2
    expect(mid(at('C major'))).toBe(0)
    expect(mid(at('G major'))).toBe(30)
    expect(mid(at('D major'))).toBe(60)
    expect(mid(at('A major'))).toBe(90)
    expect(mid(at('F major'))).toBe(330) // a fifth the other way, to the left of C
    expect(mid(at('B♭ major'))).toBe(300)
    expect(wheelPosition(0)).toBe(0)
    expect(wheelPosition(1)).toBe(1)
    expect(wheelPosition(-1)).toBe(11)
  })

  it('puts a minor key under its relative major', () => {
    const at = (name: string) => sectors.find((s) => s.name === name)!
    expect(at('A minor').from).toBe(at('C major').from)
    expect(at('C minor').from).toBe(at('E♭ major').from)
    expect(at('A minor').outerRadius).toBeLessThan(at('C major').innerRadius)
  })

  it('splits only the three shared positions: B and C♭, F♯ and G♭, C♯ and D♭', () => {
    const split = sectors
      .filter((s) => s.split && s.mode === 'major')
      .map((s) => s.name)
      .sort()
    expect(split).toEqual(
      ['B major', 'C♭ major', 'C♯ major', 'D♭ major', 'F♯ major', 'G♭ major'].sort(),
    )
    for (const s of sectors) expect(s.to - s.from).toBe(s.split ? 15 : 30)
  })

  it('has no overlaps and no gaps: each ring covers the full 360 degrees exactly once', () => {
    for (const mode of ['major', 'minor'] as const) {
      const ring = sectors.filter((s) => s.mode === mode).sort((a, b) => a.from - b.from)
      let angle = -15
      for (const s of ring) {
        expect(s.from, s.name).toBe(angle)
        angle = s.to
      }
      expect(angle).toBe(345)
    }
  })

  it('draws paths inside the wheel and labels inside their sectors', () => {
    for (const s of sectors) {
      expect(sectorPath(s)).toMatch(/^M [\d. ]+A .* Z$/)
      const p = labelPoint(s)
      const r = Math.hypot(p.x - WHEEL.center, p.y - WHEEL.center)
      expect(r).toBeGreaterThan(s.innerRadius)
      expect(r).toBeLessThan(s.outerRadius)
    }
  })

  it('turns the labels of the narrow half-sectors along the sector, never upside down; others stay horizontal', () => {
    for (const s of sectors) {
      const rot = labelRotation(s)
      if (!s.split) expect(rot, s.name).toBe(0)
      else {
        // Not upside down: the text direction must point right-ish (within 90 degrees of horizontal).
        const normalised = ((rot % 360) + 360) % 360
        expect(normalised < 90 || normalised > 270, `${s.name} ${rot}`).toBe(true)
      }
    }
  })

  it('gives the inner ring enough room: the ring is at least 30 units thick', () => {
    const minor = sectors.find((s) => s.mode === 'minor')!
    expect(minor.outerRadius - minor.innerRadius).toBeGreaterThanOrEqual(30)
  })

  it('labels majors by tonic and minors with an m', () => {
    const at = (name: string) => sectors.find((s) => s.name === name)!
    expect(at('E♭ major').label).toBe('E♭')
    expect(at('C minor').label).toBe('Cm')
    expect(at('F♯ minor').label).toBe('F♯m')
  })
})
