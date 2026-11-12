import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { KeyIdFormat } from '../keyid/questions'
import { ALL_KEYS, keyName } from '../theory/keys'
import { KeyAnswerInput } from './KeyAnswerInput'

afterEach(cleanup)

const setup = (format: KeyIdFormat, props: Partial<Parameters<typeof KeyAnswerInput>[0]> = {}) => {
  const onAnswer = vi.fn()
  render(<KeyAnswerInput format={format} onAnswer={onAnswer} {...props} />)
  return onAnswer
}

/** The keys to type for a key: e, b, Enter for E♭ major; f, #, m, Enter for F♯ minor. */
function typed(key: (typeof ALL_KEYS)[number]): string {
  const t = key.tonic
  return `${t.letter.toLowerCase()}${t.accidental === 1 ? '#' : t.accidental === -1 ? 'b' : ''}${key.mode === 'minor' ? 'm' : ''}{Enter}`
}

describe('the circle-of-fifths wheel: all 30 keys', () => {
  it('has a button for every key with its full name, and picking each gives the right answer', async () => {
    const onAnswer = setup('key')
    for (const key of ALL_KEYS) {
      await userEvent.click(screen.getByRole('button', { name: keyName(key) }))
      expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: key.accidentals, mode: key.mode })
    }
    expect(onAnswer).toHaveBeenCalledTimes(30)
  })

  it('keeps F♯/G♭, C♯/D♭ and B/C♭ apart: different keys, different answers', async () => {
    const onAnswer = setup('major')
    await userEvent.click(screen.getByRole('button', { name: 'F♯ major' }))
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: 6, mode: 'major' })
    await userEvent.click(screen.getByRole('button', { name: 'G♭ major' }))
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: -6, mode: 'major' })
    await userEvent.click(screen.getByRole('button', { name: 'C♭ major' }))
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: -7, mode: 'major' })
  })

  it('only the major ring answers; the minor ring is switched off', async () => {
    const onAnswer = setup('major')
    const minor = screen.getByRole('button', { name: 'A minor' })
    expect(minor.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(minor)
    expect(onAnswer).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'C major' }))
    expect(onAnswer).toHaveBeenCalledWith({ accidentals: 0, mode: 'major' })
  })

  it('"minor" format: only the minor ring answers', async () => {
    const onAnswer = setup('minor')
    expect(screen.getByRole('button', { name: 'C major' }).getAttribute('aria-disabled')).toBe(
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: 'C minor' }))
    expect(onAnswer).toHaveBeenCalledWith({ accidentals: -3, mode: 'minor' })
  })

  it('can be used from the keyboard: Tab to a sector and press Enter or Space', async () => {
    const onAnswer = setup('major')
    screen.getByRole('button', { name: 'D major' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: 2, mode: 'major' })
    await userEvent.keyboard(' ')
    expect(onAnswer).toHaveBeenCalledTimes(2)
  })
})

describe('typing an answer', () => {
  it('every one of the 30 keys can be typed and submitted with Enter', async () => {
    const onAnswer = setup('key')
    for (const key of ALL_KEYS) {
      await userEvent.keyboard(typed(key))
      expect(onAnswer, keyName(key)).toHaveBeenLastCalledWith({
        accidentals: key.accidentals,
        mode: key.mode,
      })
    }
    expect(onAnswer).toHaveBeenCalledTimes(30)
  })

  it('shows what has been typed so far, and a hint when it is not a key', async () => {
    setup('key')
    await userEvent.keyboard('e')
    expect(screen.getByText('E major')).toBeTruthy()
    await userEvent.keyboard('b')
    expect(screen.getByText('E♭ major')).toBeTruthy()
    await userEvent.keyboard('m')
    expect(screen.getByText('E♭ minor')).toBeTruthy()
    await userEvent.keyboard('{Escape}d#')
    expect(screen.getByText(/D♯ major: no such key/)).toBeTruthy()
  })

  it('does not submit something that is not a valid answer', async () => {
    const onAnswer = setup('key')
    await userEvent.keyboard('d#{Enter}') // D♯ major does not exist
    expect(onAnswer).not.toHaveBeenCalled()
    await userEvent.keyboard('{Enter}') // nothing typed
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('shows the typed key on the wheel as a pending choice', async () => {
    setup('major')
    await userEvent.keyboard('a')
    expect(screen.getByRole('button', { name: 'A major' }).classList.contains('pending')).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'A major' }).classList.contains('pending')).toBe(
      false,
    )
  })

  it('ignores typing into other fields, and keys held with Ctrl or Cmd', async () => {
    const onAnswer = vi.fn()
    render(
      <>
        <input aria-label="notes" />
        <KeyAnswerInput format="major" onAnswer={onAnswer} />
      </>,
    )
    await userEvent.click(screen.getByLabelText('notes'))
    await userEvent.keyboard('c{Enter}')
    expect(onAnswer).not.toHaveBeenCalled()
    ;(document.activeElement as HTMLElement).blur()
    await userEvent.keyboard('{Control>}c{/Control}{Enter}')
    expect(onAnswer).not.toHaveBeenCalled()
  })
})

describe('Type mode: no wheel to count around', () => {
  const typeMode = async (
    format: KeyIdFormat,
    props: Partial<Parameters<typeof KeyAnswerInput>[0]> = {},
  ) => {
    const onAnswer = setup(format, props)
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    return onAnswer
  }

  it('offers Wheel and Type, and Play only when the screen can listen for notes', () => {
    setup('key')
    expect(['Wheel', 'Type'].every((n) => screen.getByRole('button', { name: n }))).toBe(true)
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    cleanup()
    setup('key', { play: { onNote: vi.fn(), marks: [] } })
    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy()
  })

  it('removes every visual cue: no wheel sectors, just a text box', async () => {
    await typeMode('key')
    expect(screen.queryByRole('group', { name: /circle of fifths/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'C major' })).toBeNull()
    expect(screen.getByLabelText('Your answer')).toBeTruthy()
  })

  it('takes focus so you can start typing at once', async () => {
    await typeMode('major')
    expect(document.activeElement).toBe(screen.getByLabelText('Your answer'))
  })

  it('every one of the 30 keys can be typed into the box', async () => {
    const onAnswer = await typeMode('key')
    const box = screen.getByLabelText('Your answer')
    for (const key of ALL_KEYS) {
      await userEvent.type(box, typed(key))
      expect(onAnswer, keyName(key)).toHaveBeenLastCalledWith({
        accidentals: key.accidentals,
        mode: key.mode,
      })
    }
    expect(onAnswer).toHaveBeenCalledTimes(30)
  })

  it('shows what has been typed in the box, and clears it after an answer', async () => {
    await typeMode('key')
    const box = screen.getByLabelText('Your answer') as HTMLInputElement
    await userEvent.type(box, 'eb')
    expect(box.value).toBe('E♭ major')
    await userEvent.type(box, 'm')
    expect(box.value).toBe('E♭ minor')
    await userEvent.type(box, '{Backspace}')
    expect(box.value).toBe('E♭ major')
    await userEvent.type(box, '{Enter}')
    expect(box.value).toBe('')
  })

  it('does not take free text: the box only ever holds a valid-looking key', async () => {
    await typeMode('major')
    const box = screen.getByLabelText('Your answer') as HTMLInputElement
    await userEvent.type(box, 'hello world 123')
    expect(box.value).toMatch(/^[A-G][♭♯]? major(: no such key)?$|^$/)
  })

  it('does not submit an invalid key, and is locked after an answer', async () => {
    const onAnswer = await typeMode('key')
    await userEvent.type(screen.getByLabelText('Your answer'), 'd#{Enter}')
    expect(onAnswer).not.toHaveBeenCalled()
    cleanup()
    const locked = vi.fn()
    render(<KeyAnswerInput format="key" onAnswer={locked} disabled />)
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    expect((screen.getByLabelText('Your answer') as HTMLInputElement).disabled).toBe(true)
  })

  it('after an answer the box turns green with a check, or red with a cross and the right answer', async () => {
    setup('major', {
      disabled: true,
      feedback: {
        correct: { accidentals: -3, mode: 'major' },
        given: { accidentals: -3, mode: 'major' },
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    let box = screen.getByLabelText('Your answer') as HTMLInputElement
    expect(box.classList.contains('correct')).toBe(true)
    expect(box.value).toBe('E♭ major') // shows what was answered
    expect(document.querySelector('.type-mark')?.textContent).toBe('✓') // a shape as well as a colour
    cleanup()
    setup('major', {
      disabled: true,
      feedback: {
        correct: { accidentals: -3, mode: 'major' },
        given: { accidentals: 2, mode: 'major' },
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    box = screen.getByLabelText('Your answer') as HTMLInputElement
    expect(box.classList.contains('wrong')).toBe(true)
    expect(box.value).toBe('D major')
    expect(document.querySelector('.type-mark')?.textContent).toBe('✕')
    expect(screen.queryByText(/The answer is/)).toBeNull() // saying the right answer is left to the screen around the input
  })

  it('an answer the caller accepted (such as an enharmonic key) shows as correct even if it differs', async () => {
    setup('major', {
      disabled: true,
      feedback: {
        correct: { accidentals: 6, mode: 'major' },
        given: { accidentals: -6, mode: 'major' },
        ok: true,
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    expect(
      (screen.getByLabelText('Your answer') as HTMLInputElement).classList.contains('correct'),
    ).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'Wheel' }))
    expect(screen.getByRole('button', { name: 'G♭ major' }).classList.contains('correct')).toBe(
      true,
    ) // the accepted choice
    expect(screen.getByRole('button', { name: 'F♯ major' }).classList.contains('correct')).toBe(
      true,
    ) // and the key itself
  })

  it('can switch back to the wheel', async () => {
    await typeMode('key')
    await userEvent.click(screen.getByRole('button', { name: 'Wheel' }))
    expect(screen.getByRole('group', { name: /circle of fifths/i })).toBeTruthy()
    expect(screen.queryByLabelText('Your answer')).toBeNull()
  })
})

describe('locking and feedback', () => {
  it('ignores clicks and typing while disabled (after an answer)', async () => {
    const onAnswer = setup('major', { disabled: true })
    await userEvent.click(screen.getByRole('button', { name: 'C major' }))
    await userEvent.keyboard('c{Enter}')
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('marks the right answer with a ✓ and a wrong choice with a ✕ (shape, not just color) on the wheel', () => {
    setup('major', {
      disabled: true,
      feedback: {
        correct: { accidentals: 2, mode: 'major' },
        given: { accidentals: 3, mode: 'major' },
      },
    })
    const good = screen.getByRole('button', { name: 'D major' })
    const bad = screen.getByRole('button', { name: 'A major' })
    expect(good.classList.contains('correct')).toBe(true)
    expect(good.textContent).toContain('✓')
    expect(bad.classList.contains('wrong')).toBe(true)
    expect(bad.textContent).toContain('✕')
  })

  it('groups the wheel so a screen reader knows what it is', () => {
    setup('key')
    const wheel = screen.getByRole('group', { name: /circle of fifths/i })
    expect(within(wheel).getAllByRole('button')).toHaveLength(30)
  })
})

describe('the Play view: answering with the tonic on a piano', () => {
  it('shows a piano, reports the key struck, and tells the screen the view changed', async () => {
    const onNote = vi.fn()
    const onViewChange = vi.fn()
    setup('major', { play: { onNote, marks: [] }, onViewChange })
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(onViewChange).toHaveBeenLastCalledWith('play')
    expect(screen.queryByRole('group', { name: /circle of fifths/i })).toBeNull()
    const piano = screen.getByLabelText('Piano: play the tonic')
    const keys = piano.querySelectorAll('[data-midi]')
    expect(keys).toHaveLength(13) // one octave, C4 to C5: the tonic counts in any octave
    expect([...keys].map((k) => Number(k.getAttribute('data-midi'))).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 13 }, (_, i) => 60 + i),
    )
    await userEvent.click(keys[0] as Element)
    expect(onNote).toHaveBeenCalledWith(Number(keys[0].getAttribute('data-midi')))
    await userEvent.click(screen.getByRole('button', { name: 'Wheel' }))
    expect(onViewChange).toHaveBeenLastCalledWith('wheel')
  })

  it('typing does not answer while in the Play view, and the hint says to play', async () => {
    const onAnswer = setup('major', { play: { onNote: vi.fn(), marks: [] } })
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    await userEvent.keyboard('c{Enter}')
    expect(onAnswer).not.toHaveBeenCalled()
    expect(screen.getByText(/Play the tonic of the key/)).toBeTruthy()
  })

  it('marks the key that was played', async () => {
    setup('major', {
      play: { onNote: vi.fn(), marks: [{ midi: 60, kind: 'wrong' as const }] },
      disabled: true,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    const key = document.querySelector('[data-midi="60"]')
    expect(key?.getAttribute('class') ?? '').toMatch(/wrong/)
  })
})

describe('wrong guesses while the question is still open', () => {
  const wrong = [
    { accidentals: 2, mode: 'major' as const },
    { accidentals: -1, mode: 'major' as const },
  ]

  it('each wrong key stays marked ✕ on the wheel and cannot be picked again, but the rest still work', async () => {
    const onAnswer = setup('major', { wrong })
    for (const name of ['D major', 'F major']) {
      const sector = screen.getByRole('button', { name })
      expect(sector.classList.contains('wrong')).toBe(true)
      expect(sector.textContent).toContain('✕')
      expect(sector.getAttribute('aria-disabled')).toBe('true')
      await userEvent.click(sector)
    }
    expect(onAnswer).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'C major' }))
    expect(onAnswer).toHaveBeenCalledWith({ accidentals: 0, mode: 'major' })
    // Nothing is marked as right: the answer is not given away.
    expect(document.querySelectorAll('.wheel-key.correct')).toHaveLength(0)
  })

  it('the Type box shows the last wrong guess in red with a ✕ until you start typing the next one', async () => {
    setup('major', { wrong })
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    const box = screen.getByLabelText('Your answer') as HTMLInputElement
    expect(box.value).toBe('F major') // the last one named
    expect(box.classList.contains('wrong')).toBe(true)
    expect(document.querySelector('.type-mark')?.textContent).toBe('✕')
    expect(document.querySelector('.type-hint')).toBeNull() // the hint would sit on top of it
    await userEvent.type(box, 'e')
    expect(box.value).toBe('E major')
    expect(box.classList.contains('wrong')).toBe(false)
    expect(document.querySelector('.type-mark')).toBeNull()
  })

  it('the piano marks every wrong note played so far, and the right one when it comes', async () => {
    setup('major', {
      play: {
        onNote: vi.fn(),
        marks: [
          { midi: 60, kind: 'wrong' as const },
          { midi: 62, kind: 'wrong' as const },
          { midi: 63, kind: 'right' as const },
        ],
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    const cls = (m: number) =>
      document.querySelector(`[data-midi="${m}"]`)?.getAttribute('class') ?? ''
    expect(cls(60)).toMatch(/wrong/)
    expect(cls(62)).toMatch(/wrong/)
    expect(cls(63)).toMatch(/heard/)
  })
})

describe('when time runs out the right answer is shown in the "to play" colour, not as a success', () => {
  const timedOut = {
    disabled: true,
    feedback: { correct: { accidentals: 2, mode: 'major' as const }, given: null, ok: false },
  }

  it('on the wheel: purple with a dot, and not green', () => {
    setup('major', timedOut)
    const d = screen.getByRole('button', { name: 'D major' })
    expect(d.classList.contains('reveal')).toBe(true)
    expect(d.classList.contains('correct')).toBe(false)
    expect(d.textContent).toContain('●')
    expect(d.textContent).not.toContain('✓')
    expect(document.querySelectorAll('.wheel-key.correct')).toHaveLength(0)
  })

  it('in the Type box: the answer in purple', async () => {
    setup('major', timedOut)
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    const box = screen.getByLabelText('Your answer') as HTMLInputElement
    expect(box.value).toBe('D major')
    expect(box.classList.contains('reveal')).toBe(true)
    expect(box.classList.contains('correct')).toBe(false)
    expect(box.classList.contains('wrong')).toBe(false)
    expect(document.querySelector('.type-mark')?.textContent).toBe('●')
  })

  it('on the piano: keys marked "to play"', async () => {
    setup('major', {
      ...timedOut,
      play: { onNote: vi.fn(), marks: [{ midi: 62, kind: 'target' }] },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(document.querySelector('[data-midi="62"]')?.getAttribute('class')).toMatch(/target/)
  })

  it('a right answer is still green', () => {
    setup('major', {
      disabled: true,
      feedback: {
        correct: { accidentals: 2, mode: 'major' },
        given: { accidentals: 2, mode: 'major' },
        ok: true,
      },
    })
    const d = screen.getByRole('button', { name: 'D major' })
    expect(d.classList.contains('correct')).toBe(true)
    expect(d.classList.contains('reveal')).toBe(false)
  })
})
