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

  it('always shows both staves, leaving the unused one empty', () => {
    show() // right hand only
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(2)
    expect(document.querySelectorAll('.staff .vf-clef')).toHaveLength(2)
  })

  it('loads a preset level: its hands and notes show up, and the picker returns to Custom on an edit', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Level'), '7')
    expect(screen.getByText(/one or two notes in each hand/i)).toBeTruthy() // the level's description
    expect(tile(/both hands/i).getAttribute('aria-pressed')).toBe('true')
    expect(tile(/right hand only/i).getAttribute('aria-pressed')).toBe('false')
    // Notes per hand is the same control for both hands: level 7 is 1 and 2 notes.
    expect(tile(/1 note/i).getAttribute('aria-pressed')).toBe('true')
    expect(tile(/2 notes/i).getAttribute('aria-pressed')).toBe('true')
    expect(tile(/3 notes/i).getAttribute('aria-pressed')).toBe('false')
    expect(document.body.textContent).toMatch(/LH \[.*\]\s+RH \[/)
    await userEvent.click(tile(/3 notes/i))
    expect((screen.getByLabelText('Level') as HTMLSelectElement).value).toBe('custom')
  })

  it('there are no voicing controls: both hands uses the same settings as one hand', async () => {
    show()
    await userEvent.click(tile(/both hands/i))
    expect(screen.queryByText(/voicing/i)).toBeNull()
    expect(screen.queryByLabelText(/bass root/i)).toBeNull()
    for (const name of [/1 note/i, /2 notes/i, /3 notes/i, /4 notes/i])
      expect(tile(name)).toBeTruthy() // the same notes-per-hand tiles
  })

  it('level 1 is right-hand single notes in C major', async () => {
    show()
    await userEvent.selectOptions(screen.getByLabelText('Level'), '1')
    expect(tile(/right hand only/i).getAttribute('aria-pressed')).toBe('true')
    expect(tile(/1 note/i).getAttribute('aria-pressed')).toBe('true')
    expect(document.body.textContent).toMatch(/C major: note/)
  })

  it('shows the current settings as JSON', async () => {
    show()
    expect(screen.getByText('Settings JSON')).toBeTruthy()
    expect(document.body.textContent).toContain('"hands"')
  })

  it('shows 5-notes as unavailable for now', () => {
    show()
    expect((tile(/5 notes/i) as HTMLButtonElement).disabled).toBe(true)
  })

  it('both hands draws a grand staff with a bass-clef and a treble-clef part and a keyboard', async () => {
    show()
    await userEvent.click(tile(/both hands/i))
    await userEvent.click(tile(/right hand only/i)) // leave only "both hands"
    expect(tile(/both hands/i).getAttribute('aria-pressed')).toBe('true')
    expect(document.body.textContent).toMatch(/LH \[.*\]\s+RH \[.*\]/)
    expect(document.querySelectorAll('.staff .vf-stave')).toHaveLength(2)
    expect(document.querySelector('svg.keyboard')).toBeTruthy()
  })

  it('shows note names when asked', async () => {
    show()
    expect(document.querySelectorAll('.note-name')).toHaveLength(0)
    await userEvent.click(screen.getByLabelText(/show note names/i))
    expect(document.querySelectorAll('.note-name').length).toBeGreaterThanOrEqual(3)
  })

  it('click a target key to cycle it: almost, heard, then clear; the staff and counter follow', async () => {
    show()
    const target = document.querySelector('.kb-key.target') as SVGElement
    const midi = target.dataset.midi!
    const key = () => document.querySelector(`.kb-key[data-midi="${midi}"]`) as SVGElement
    expect(document.body.textContent).toMatch(/0 \/ 3 notes heard/)
    await userEvent.click(key())
    expect(key().classList.contains('almost')).toBe(true)
    expect(document.querySelectorAll('.note-halo.almost')).toHaveLength(1)
    await userEvent.click(key())
    expect(key().classList.contains('heard')).toBe(true)
    expect(document.querySelectorAll('.note-halo.heard')).toHaveLength(1)
    expect(document.body.textContent).toMatch(/1 \/ 3 notes heard/)
    await userEvent.click(key())
    expect(key().classList.contains('target')).toBe(true)
    expect(document.querySelectorAll('.note-halo')).toHaveLength(0)
  })

  it('a key that is not in the target can be marked as a wrong note, and unmarked', async () => {
    show()
    const plain = [...document.querySelectorAll('.kb-key.white')].find(
      (k) => !k.classList.contains('target'),
    ) as SVGElement
    await userEvent.click(plain)
    expect(plain.classList.contains('wrong')).toBe(true)
    await userEvent.click(plain)
    expect(plain.classList.contains('wrong')).toBe(false)
  })

  it('Next target clears the feedback marks', async () => {
    show()
    await userEvent.click(document.querySelector('.kb-key.target') as SVGElement)
    expect(document.querySelectorAll('.note-halo').length).toBeGreaterThan(0)
    await userEvent.click(screen.getByRole('button', { name: /next target/i }))
    expect(document.querySelectorAll('.note-halo')).toHaveLength(0)
  })

  it('gives each picture an accessible description', () => {
    show()
    expect(
      screen.getAllByRole('img', { name: /hand resting on the piano keys/i }).length,
    ).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('img', { name: /both hands resting/i })).toBeTruthy()
  })
})
