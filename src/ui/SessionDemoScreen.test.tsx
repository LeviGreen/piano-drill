import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { SessionDemoScreen } from './SessionDemoScreen'

beforeAll(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(cleanup)

const show = () =>
  render(
    <MemoryRouter>
      <SessionDemoScreen />
    </MemoryRouter>,
  )

describe('session demo', () => {
  it('shows an empty grand staff from the start, so nothing appears or shifts when the game begins', () => {
    show()
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(2)
    expect(document.querySelectorAll('.staff .vf-clef')).toHaveLength(2)
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(0)
  })

  it('counts down from 4 over the empty staff before the first target, then shows nothing more', async () => {
    show()
    expect(screen.queryByRole('timer')).toBeNull() // idle: no countdown
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    const timer = screen.getByRole('timer')
    expect(timer.textContent).toBe('4')
    expect(timer.closest('.stage')?.querySelector('.staff')).toBeTruthy() // drawn over the staff area, not in the flow
    await userEvent.click(screen.getByRole('button', { name: 'End' }))
    expect(screen.queryByRole('timer')).toBeNull()
  })

  it('keeps the empty staff while getting ready', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByText(/Get ready/)).toBeTruthy()
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(2)
    expect(document.querySelectorAll('.staff .vf-notehead')).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'End' }))
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(2) // still there after the session ends
  })

  it('starts idle with the controls in the right state', () => {
    show()
    expect(screen.getByText('Pick a level and press Start.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect((screen.getByRole('button', { name: 'Pause' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Skip' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('None yet.')).toBeTruthy()
  })

  it('has no get-ready setting: the wait is a fixed 4 seconds', () => {
    show()
    expect(screen.queryByLabelText(/Get-ready/i)).toBeNull()
  })

  it('Start moves to getting ready and locks the level picker; End returns to idle-like state', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(screen.getByText(/Get ready/)).toBeTruthy()
    expect((screen.getByLabelText('Level') as HTMLSelectElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: 'End' }))
    expect(screen.getByText('Session ended.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Start' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('Pause pauses and Resume comes back', async () => {
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Start' }))
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
    expect(screen.getByText(/Paused/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }))
    expect(screen.getByText(/Get ready/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'End' }))
  })
})
