import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isBlackKey, keyboardLayout, WHITE_H, WHITE_W } from './keyboardLayout'
import { PianoKeyboard, type KeyMark } from './PianoKeyboard'

afterEach(cleanup)

describe('keyboard layout', () => {
  it('knows which keys are black', () => {
    const black = [...Array(12).keys()].filter((n) => isBlackKey(60 + n)).map((n) => n)
    expect(black).toEqual([1, 3, 6, 8, 10])
  })

  it('G2 to F5 (a smaller range) has 21 white and 14 black keys, laid out left to right', () => {
    const { keys, width } = keyboardLayout(43, 77)
    expect(keys.filter((k) => !k.black)).toHaveLength(21)
    expect(keys.filter((k) => k.black)).toHaveLength(14)
    expect(width).toBe(21 * WHITE_W)
    const whites = keys.filter((k) => !k.black)
    for (let i = 1; i < whites.length; i++) expect(whites[i].x).toBe(whites[i - 1].x + WHITE_W)
  })

  it('places each black key on the boundary between its two white neighbours', () => {
    const { keys } = keyboardLayout(60, 72) // C4 to C5
    const white = (m: number) => keys.find((k) => k.midi === m)!
    const black = (m: number) => keys.find((k) => k.midi === m)!
    const boundary = (lowerWhite: number) => white(lowerWhite).x + WHITE_W
    expect(black(61).x + black(61).width / 2).toBeCloseTo(boundary(60)) // C# between C and D
    expect(black(70).x + black(70).width / 2).toBeCloseTo(boundary(69)) // A# between A and B
  })

  it('rejects ranges that start or end on a black key', () => {
    expect(() => keyboardLayout(61, 72)).toThrow(RangeError)
    expect(() => keyboardLayout(60, 73)).toThrow(RangeError)
    expect(() => keyboardLayout(72, 60)).toThrow(RangeError)
  })
})

describe('PianoKeyboard', () => {
  const marks = new Map<number, KeyMark>([
    [60, 'target'],
    [64, 'heard'],
    [67, 'almost'],
    [61, 'wrong'],
  ])

  it('shows every mark by shape as well as color', () => {
    const { container } = render(<PianoKeyboard marks={marks} />)
    const symbols = [...container.querySelectorAll('.kb-mark')].map((e) => e.textContent).sort()
    expect(symbols).toEqual(['~', '●', '✓', '✕'])
    expect(container.querySelectorAll('.kb-key.target')).toHaveLength(1)
    expect(container.querySelectorAll('.kb-key.heard')).toHaveLength(1)
  })

  it('prints names on marked keys only when asked', () => {
    const labels = new Map([
      [60, 'C4'],
      [64, 'E4'],
      [67, 'G4'],
      [61, 'D♭4'],
    ])
    const off = render(<PianoKeyboard marks={marks} labels={labels} />)
    expect(off.container.querySelectorAll('.kb-name')).toHaveLength(0)
    cleanup()
    const on = render(<PianoKeyboard marks={marks} labels={labels} showNames />)
    expect([...on.container.querySelectorAll('.kb-name')].map((e) => e.textContent).sort()).toEqual(
      ['C4', 'D♭4', 'E4', 'G4'],
    )
  })

  it('prints black-key names on a second line below the keyboard, clear of the white-key names', () => {
    const labels = new Map([
      [60, 'C4'],
      [61, 'D♭4'],
    ])
    const { container } = render(
      <PianoKeyboard
        marks={
          new Map<number, KeyMark>([
            [60, 'target'],
            [61, 'target'],
          ])
        }
        labels={labels}
        showNames
      />,
    )
    const y = (text: string) =>
      Number(
        [...container.querySelectorAll('.kb-name')]
          .find((e) => e.textContent === text)!
          .getAttribute('y'),
      )
    expect(y('C4')).toBeGreaterThan(WHITE_H) // below the keys, not on them
    expect(y('D♭4')).toBeGreaterThan(y('C4')) // black-key names are on the line below
  })

  it('is plain (not clickable) without a click handler, and clickable with one', async () => {
    const plain = render(<PianoKeyboard marks={marks} />)
    expect(plain.container.querySelectorAll('[role="button"]')).toHaveLength(0)
    cleanup()
    const onKeyClick = vi.fn()
    render(<PianoKeyboard marks={marks} onKeyClick={onKeyClick} />)
    await userEvent.click(screen.getByRole('button', { name: /^C4, to play$/ }))
    expect(onKeyClick).toHaveBeenCalledWith(60)
    screen.getByRole('button', { name: /^E4, heard$/ }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onKeyClick).toHaveBeenCalledWith(64)
  })

  it('draws the whole MVP range by default', () => {
    const { container } = render(<PianoKeyboard />)
    expect(container.querySelectorAll('.kb-key')).toHaveLength(49) // C2 to C6: 29 white and 20 black
    expect(container.querySelector('[data-midi="36"]')).toBeTruthy()
    expect(container.querySelector('[data-midi="84"]')).toBeTruthy()
    expect(container.querySelector('[data-midi="35"]')).toBeNull()
    expect(container.querySelector('[data-midi="85"]')).toBeNull()
  })
})

describe('playing the keys (press and release)', () => {
  const key = (midi: number) => document.querySelector(`[data-midi="${midi}"]`)!

  it('several fingers press several keys at once, and each lifts on its own', () => {
    const press = vi.fn()
    const release = vi.fn()
    render(<PianoKeyboard onKeyPress={press} onKeyRelease={release} />)
    fireEvent.pointerDown(key(60), { pointerId: 1 })
    fireEvent.pointerDown(key(64), { pointerId: 2 })
    fireEvent.pointerDown(key(67), { pointerId: 3 })
    expect(press.mock.calls.map((c) => c[0])).toEqual([60, 64, 67])
    expect(release).not.toHaveBeenCalled()
    fireEvent.pointerUp(window, { pointerId: 2 })
    expect(release.mock.calls.map((c) => c[0])).toEqual([64])
    fireEvent.pointerUp(window, { pointerId: 1 })
    fireEvent.pointerCancel(window, { pointerId: 3 })
    expect(release.mock.calls.map((c) => c[0])).toEqual([64, 60, 67])
  })

  it('releases wherever the finger lets go, and not twice', () => {
    const release = vi.fn()
    render(<PianoKeyboard onKeyPress={vi.fn()} onKeyRelease={release} />)
    fireEvent.pointerDown(key(60), { pointerId: 1 })
    fireEvent.pointerUp(document.body, { pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('lets go of held keys if the keyboard goes away', () => {
    const release = vi.fn()
    const { unmount } = render(<PianoKeyboard onKeyPress={vi.fn()} onKeyRelease={release} />)
    fireEvent.pointerDown(key(60), { pointerId: 1 })
    unmount()
    expect(release).toHaveBeenCalledWith(60)
  })

  it('works from the keyboard too: Enter presses, and lifting the key releases', async () => {
    const press = vi.fn()
    const release = vi.fn()
    render(<PianoKeyboard onKeyPress={press} onKeyRelease={release} />)
    ;(key(60) as SVGElement & HTMLElement).focus()
    await userEvent.keyboard('{Enter}')
    expect(press).toHaveBeenCalledWith(60)
    expect(release).toHaveBeenCalledWith(60)
  })
})
