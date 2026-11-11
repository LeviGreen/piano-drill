import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { GeneratorPreviewScreen } from './GeneratorPreviewScreen'

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(cleanup)

const show = () =>
  render(
    <MemoryRouter>
      <GeneratorPreviewScreen />
    </MemoryRouter>,
  )
const tile = (name: RegExp) => screen.getByRole('button', { name })

describe('generator preview picture toggles', () => {
  it('starts with the right hand and 3 notes selected and draws a target', () => {
    show()
    expect(tile(/right hand only/i).getAttribute('aria-pressed')).toBe('true')
    expect(tile(/left hand only/i).getAttribute('aria-pressed')).toBe('false')
    expect(tile(/3 notes/i).getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.staff svg')).toBeTruthy()
  })

  it('toggles a hand on and off like a checkbox, but never turns off the last one', async () => {
    show()
    await userEvent.click(tile(/left hand only/i))
    expect(tile(/left hand only/i).getAttribute('aria-pressed')).toBe('true')
    await userEvent.click(tile(/right hand only/i))
    expect(tile(/right hand only/i).getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(tile(/left hand only/i)) // the last one stays on
    expect(tile(/left hand only/i).getAttribute('aria-pressed')).toBe('true')
  })

  it('toggles notes-per-hand the same way and uses the chosen hand', async () => {
    show()
    await userEvent.click(tile(/1 note/i))
    await userEvent.click(tile(/3 notes/i))
    expect(tile(/1 note/i).getAttribute('aria-pressed')).toBe('true')
    expect(tile(/3 notes/i).getAttribute('aria-pressed')).toBe('false')
    await userEvent.click(tile(/left hand only/i))
    await userEvent.click(tile(/right hand only/i))
    expect(document.body.textContent).toMatch(/\[[A-G][♯♭]?\d\]/) // a single-note target such as [E3]
  })

  it('shows both-hands and 5-notes as unavailable for now', () => {
    show()
    expect((tile(/both hands/i) as HTMLButtonElement).disabled).toBe(true)
    expect((tile(/5 notes/i) as HTMLButtonElement).disabled).toBe(true)
  })

  it('gives each picture an accessible description', () => {
    show()
    expect(
      screen.getAllByRole('img', { name: /hand resting on the piano keys/i }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('img', { name: /both hands resting/i })).toBeTruthy()
  })
})
