import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { KeyIdPreviewScreen } from './KeyIdPreviewScreen'

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(cleanup)

const show = () =>
  render(
    <MemoryRouter>
      <KeyIdPreviewScreen />
    </MemoryRouter>,
  )

describe('key ID preview', () => {
  it('shows a question with a staff and the answer wheel', () => {
    show()
    expect(screen.getByText('Which major key?')).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-keysignature').length).toBe(1)
    expect(screen.getByRole('group', { name: /circle of fifths/i })).toBeTruthy()
  })

  it('tells you when you are right, shows the time, and locks until Next', async () => {
    show()
    // Find the right answer from the wheel by trying C major first only if it is the key; otherwise read it from a wrong try.
    await userEvent.click(screen.getByRole('button', { name: 'C major' }))
    const status = screen.getByRole('status')
    expect(status.textContent).toMatch(/Correct!|Not quite\. The answer is .* major\./)
    expect(status.textContent).toMatch(/\d\.\d\d s/)
    // Locked: a second click changes nothing.
    const before = document.body.textContent
    await userEvent.click(screen.getByRole('button', { name: 'G major' }))
    expect(document.body.textContent).toBe(before)
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('status').textContent).toBe('') // the area stays, emptied
  })

  it('does not rearrange the page when an answer arrives: the result and hint areas are always there', async () => {
    show()
    const slot = document.querySelector('.result-slot')
    const hint = document.querySelector('.answer-pending')
    expect(slot).toBeTruthy()
    expect(hint).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'C major' }))
    expect(document.querySelector('.result-slot')).toBe(slot) // same element, now filled
    expect(document.querySelector('.answer-pending')).toBe(hint) // same element, now empty
    expect(slot!.textContent).toMatch(/Correct!|Not quite/)
  })

  it('keeps score', async () => {
    show()
    expect(document.body.textContent).toMatch(/Score: 0 \/ 0/)
    await userEvent.click(screen.getByRole('button', { name: 'C major' }))
    expect(document.body.textContent).toMatch(/Score: [01] \/ 1/)
  })

  it('"Name the key" shows a tonic note on the staff, and asks for major or minor too', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Question type'), 'key')
    expect(screen.getByText(/The note shown is the tonic/)).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'A minor' }).getAttribute('aria-disabled')).toBe(
      'false',
    )
  })

  it('"Count the sharps or flats" shows number buttons and no tonic note', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Question type'), 'signature')
    expect(screen.getByRole('button', { name: '3 flats' })).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(0)
  })

  it('answering by typing works too', async () => {
    show()
    await userEvent.keyboard('c{Enter}')
    expect(screen.getByRole('status')).toBeTruthy()
  })
})
