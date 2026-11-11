import { beforeAll, describe, expect, it, vi } from 'vitest'
import { ALL_KEYS, keyName, keySignature, signaturePlacement } from '../theory/keys'
import { parsePitch } from '../theory/pitch'
import { staffPosition, type Clef } from '../theory/staff'
import { renderStaff, STAFF_SIZE } from './renderStaff'
import { vexKeySpec, vexNoteKey } from './vexKey'

// VexFlow measures text with a canvas that jsdom lacks; it falls back gracefully but logs every time.
beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

const draw = (clef: Clef, key = keySignature(0, 'major'), notes?: string[]) => {
  const div = document.createElement('div')
  document.body.appendChild(div)
  const handle = renderStaff(div, { clef, key, notes: notes?.map(parsePitch) })
  return { div, handle }
}

describe('VexFlow key names', () => {
  it('builds specs for majors and minors', () => {
    expect(vexKeySpec(keySignature(6, 'major'))).toBe('F#')
    expect(vexKeySpec(keySignature(-7, 'major'))).toBe('Cb')
    expect(vexKeySpec(keySignature(-3, 'minor'))).toBe('Cm')
    expect(vexKeySpec(keySignature(5, 'minor'))).toBe('G#m')
    expect(vexKeySpec(keySignature(-7, 'minor'))).toBe('Abm')
  })

  it('builds note keys', () => {
    expect(vexNoteKey(parsePitch('C4'))).toBe('c/4')
    expect(vexNoteKey(parsePitch('F#5'))).toBe('f#/5')
    expect(vexNoteKey(parsePitch('Bb3'))).toBe('bb/3')
    expect(vexNoteKey(parsePitch('Ebb4'))).toBe('ebb/4')
  })
})

describe('single staff renderer', () => {
  it('draws an SVG with five staff lines, a clef and a responsive viewBox', () => {
    const { div } = draw('treble')
    const svg = div.querySelector('svg')!
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('viewBox')).toBe('0 0 320 110')
    expect(svg.style.width).toBe('100%') // fills its container, whatever pixel size VexFlow wrote
    expect(div.querySelectorAll('.vf-stavenote').length).toBe(0)
  })

  it('replaces its contents on a redraw instead of stacking', () => {
    const { div } = draw('bass')
    renderStaff(div, { clef: 'treble', key: keySignature(2, 'major') })
    expect(div.querySelectorAll('svg')).toHaveLength(1)
  })

  it('draws every key signature (all 30 keys, both clefs) in exactly the positions our table says', () => {
    for (const key of ALL_KEYS) {
      for (const clef of ['treble', 'bass'] as const) {
        const { handle } = draw(clef, key)
        const expected = signaturePlacement(key, clef).map((p) => ({
          type: p.spelling.accidental === 1 ? '#' : 'b',
          // VexFlow counts staff lines down from the top line (0), half a unit per step; our staffPosition counts up from the bottom line.
          line: (8 - staffPosition(p, clef)) / 2,
        }))
        expect(handle.signatureAccidentals, `${keyName(key)} ${clef}`).toEqual(expected)
      }
    }
  })

  it('leaves room above and below the staff for the clef, accidentals and ledger lines (nothing clipped)', () => {
    const { handle } = draw('treble')
    expect(handle.lineY.bottom - handle.lineY.top).toBe(40) // four spaces of 10
    expect(handle.lineY.top).toBeGreaterThanOrEqual(30)
    expect(STAFF_SIZE.height - handle.lineY.bottom).toBeGreaterThanOrEqual(30)
  })

  it('draws no signature accidentals for C major and A minor', () => {
    expect(draw('treble', keySignature(0, 'major')).handle.signatureAccidentals).toEqual([])
    expect(draw('bass', keySignature(0, 'minor')).handle.signatureAccidentals).toEqual([])
  })
})

describe('notes on the staff', () => {
  it('draws one notehead per pitch', () => {
    expect(draw('treble', undefined, ['C4']).div.querySelectorAll('.vf-notehead')).toHaveLength(1)
    expect(
      draw('treble', undefined, ['C4', 'E4', 'G4']).div.querySelectorAll('.vf-notehead'),
    ).toHaveLength(3)
    expect(
      draw('bass', undefined, ['G2', 'D3', 'G3', 'B3', 'D4']).div.querySelectorAll('.vf-notehead'),
    ).toHaveLength(5)
  })

  it('only writes accidentals the key signature does not already imply', () => {
    const shown = (key: ReturnType<typeof keySignature>, notes: string[]) =>
      draw('treble', key, notes).handle.noteAccidentals
    const dMajor = keySignature(2, 'major')
    expect(shown(dMajor, ['F#4'])).toEqual([]) // in the key signature
    expect(shown(dMajor, ['F4'])).toEqual(['n']) // needs a natural
    expect(shown(keySignature(0, 'major'), ['F#4'])).toEqual(['#']) // needs a sharp
    expect(shown(keySignature(-3, 'major'), ['Bb4', 'Eb5'])).toEqual([])
    expect(shown(keySignature(-3, 'major'), ['B4'])).toEqual(['n'])
    expect(shown(keySignature(0, 'major'), ['F##4', 'Bbb4'])).toEqual(['##', 'bb'])
  })

  it('handles seconds, double accidentals and ledger lines without throwing', () => {
    const c = keySignature(0, 'major')
    expect(() => draw('treble', c, ['E4', 'F4', 'G4'])).not.toThrow()
    expect(() => draw('treble', c, ['F##4', 'Bbb4'])).not.toThrow()
    expect(() => draw('treble', c, ['C4', 'E5'])).not.toThrow()
    expect(() => draw('bass', c, ['C4', 'G2'])).not.toThrow()
  })
})
