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

  it('"major" format: only the major ring answers; the minor ring is switched off', async () => {
    const onAnswer = setup('major')
    const minor = screen.getByRole('button', { name: 'A minor' })
    expect(minor.getAttribute('aria-disabled')).toBe('true')
    await userEvent.click(minor)
    expect(onAnswer).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'C major' }))
    expect(onAnswer).toHaveBeenCalledWith({ accidentals: 0, mode: 'major' })
  })

  it('"pair" format: either ring picks the pair, and the answer has no mode', async () => {
    const onAnswer = setup('pair')
    await userEvent.click(screen.getByRole('button', { name: 'C minor' }))
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: -3 })
    await userEvent.click(screen.getByRole('button', { name: 'E♭ major' }))
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: -3 })
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

describe('the button grid', () => {
  it('"key" format: Major and Minor pages of 15 keys each, in order from 7 flats to 7 sharps; every key answers correctly', async () => {
    const onAnswer = setup('key')
    await userEvent.click(screen.getByRole('button', { name: 'Grid' }))
    for (const mode of ['major', 'minor'] as const) {
      await userEvent.click(
        screen.getByRole('button', { name: mode === 'major' ? 'Major' : 'Minor' }),
      )
      for (const key of ALL_KEYS.filter((k) => k.mode === mode)) {
        await userEvent.click(screen.getByRole('button', { name: keyName(key) }))
        expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: key.accidentals, mode })
      }
    }
    expect(onAnswer).toHaveBeenCalledTimes(30)
  })

  it('"major" format grid has 15 major keys and no mode switch', async () => {
    setup('major')
    await userEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(screen.queryByRole('button', { name: 'Minor' })).toBeNull()
    expect(screen.getByRole('button', { name: 'A♭ major' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'A minor' })).toBeNull()
  })

  it('"pair" format grid shows each pair, e.g. E♭ major / C minor', async () => {
    const onAnswer = setup('pair')
    await userEvent.click(screen.getByRole('button', { name: 'Grid' }))
    await userEvent.click(screen.getByRole('button', { name: 'E♭ major / C minor' }))
    expect(onAnswer).toHaveBeenCalledWith({ accidentals: -3 })
  })

  it('"signature" format: 15 buttons from 7 flats to 7 sharps, always a grid', async () => {
    const onAnswer = setup('signature')
    expect(screen.queryByRole('button', { name: 'Wheel' })).toBeNull() // no wheel for counting
    for (let n = -7; n <= 7; n++) {
      const name =
        n === 0
          ? 'No sharps or flats'
          : `${Math.abs(n)} ${n > 0 ? 'sharp' : 'flat'}${Math.abs(n) > 1 ? 's' : ''}`
      await userEvent.click(screen.getByRole('button', { name }))
      expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: n })
    }
    expect(onAnswer).toHaveBeenCalledTimes(15)
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

  it('the signature format is typed with a digit and a sign', async () => {
    const onAnswer = setup('signature')
    await userEvent.keyboard('3b{Enter}')
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: -3 })
    await userEvent.keyboard('0{Enter}')
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: 0 })
    await userEvent.keyboard('7#{Enter}')
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: 7 })
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

describe('Type mode: no wheel or grid to count around', () => {
  const typeMode = async (
    format: KeyIdFormat,
    props: Partial<Parameters<typeof KeyAnswerInput>[0]> = {},
  ) => {
    const onAnswer = setup(format, props)
    await userEvent.click(screen.getByRole('button', { name: 'Type' }))
    return onAnswer
  }

  it('offers Wheel, Grid and Type for key names, and Grid and Type for counting', () => {
    setup('key')
    expect(['Wheel', 'Grid', 'Type'].every((n) => screen.getByRole('button', { name: n }))).toBe(
      true,
    )
    cleanup()
    setup('signature')
    expect(screen.queryByRole('button', { name: 'Wheel' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Grid' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Type' })).toBeTruthy()
  })

  it('removes every visual cue: no wheel sectors, no grid buttons, just a text box', async () => {
    await typeMode('key')
    expect(screen.queryByRole('group', { name: /circle of fifths/i })).toBeNull()
    expect(screen.queryByRole('button', { name: 'C major' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Major' })).toBeNull()
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

  it('counting by typing: a digit and a sign', async () => {
    const onAnswer = await typeMode('signature')
    const box = screen.getByLabelText('Your answer')
    await userEvent.type(box, '3b{Enter}')
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: -3 })
    await userEvent.type(box, '0{Enter}')
    expect(onAnswer).toHaveBeenLastCalledWith({ accidentals: 0 })
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

  it('marks answers on the grid too, and a pair lights up both rings of the wheel', async () => {
    setup('signature', {
      disabled: true,
      feedback: { correct: { accidentals: -2 }, given: { accidentals: 4 } },
    })
    expect(screen.getByRole('button', { name: '2 flats' }).textContent).toContain('✓')
    expect(screen.getByRole('button', { name: '4 sharps' }).textContent).toContain('✕')
    cleanup()
    setup('pair', {
      disabled: true,
      feedback: { correct: { accidentals: -3 }, given: { accidentals: -3 } },
    })
    expect(screen.getByRole('button', { name: 'E♭ major' }).classList.contains('correct')).toBe(
      true,
    )
    expect(screen.getByRole('button', { name: 'C minor' }).classList.contains('correct')).toBe(true)
  })

  it('puts grid marks on top of the buttons, in their own element, so buttons never change size', () => {
    setup('signature', {
      disabled: true,
      feedback: { correct: { accidentals: -2 }, given: { accidentals: 4 } },
    })
    const good = screen.getByRole('button', { name: '2 flats' })
    expect(good.querySelector('.answer-mark')?.textContent).toBe('✓')
  })

  it('groups the wheel so a screen reader knows what it is', () => {
    setup('key')
    const wheel = screen.getByRole('group', { name: /circle of fifths/i })
    expect(within(wheel).getAllByRole('button')).toHaveLength(30)
  })
})
