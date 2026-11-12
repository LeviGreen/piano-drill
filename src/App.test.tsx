import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import App from './App'
import { ThemeProvider } from './ui/ThemeProvider'
import { THEME_STORAGE_KEY } from './ui/theme'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})
afterEach(cleanup)

describe('routing', () => {
  it('shows the home screen with links to every section', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Piano Drill' })).toBeTruthy()
    for (const name of ['Play', 'Key ID', 'Scores', 'Settings']) {
      expect(screen.getAllByRole('link', { name: new RegExp(name) }).length).toBeGreaterThan(0)
    }
  })

  it.each([
    ['/play', 'Play'],
    ['/key-id', 'Key ID'],
    ['/settings', 'Settings'],
  ])('renders %s', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeTruthy()
  })

  it('navigates via the main nav', async () => {
    renderAt('/')
    await userEvent.click(
      screen.getByRole('navigation', { name: 'Main' }).querySelector('a[href="/settings"]')!,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
  })

  it('shows a not-found page for unknown routes', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeTruthy()
  })
})

describe('theme', () => {
  it('applies and persists the chosen theme', async () => {
    renderAt('/')
    await userEvent.selectOptions(screen.getByLabelText('Theme'), 'high-contrast')
    expect(document.documentElement.getAttribute('data-theme')).toBe('high-contrast')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('high-contrast')
  })

  it('restores a saved theme on load', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderAt('/')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect((screen.getByLabelText('Theme') as HTMLSelectElement).value).toBe('dark')
  })
})
