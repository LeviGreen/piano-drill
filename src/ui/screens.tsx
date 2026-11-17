import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PianoIcon } from './icons'
import { NAV_ITEMS } from './nav'

const DESCRIPTIONS: Record<string, string> = {
  '/sight-read': 'Flash a chord or interval, play it, beat the clock.',
  '/key-signatures': 'Name the key signature as fast as you can.',
  '/scores': 'The top ten scores for each level.',
  '/settings': 'Input, timing and display options.',
}

export function HomeScreen() {
  return (
    <>
      <h1>Piano Drill</h1>
      <p className="placeholder">Short, timed reps to make sight-reading instant.</p>
      <div className="card-grid">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className="card">
            <h2>{item.label}</h2>
            <p>{DESCRIPTIONS[item.to]}</p>
          </Link>
        ))}
      </div>
    </>
  )
}

const TOOLS: { label: string; to: string; icon: ReactNode; enabled: boolean; note: string }[] = [
  {
    label: 'MIDI Test',
    to: '/settings/midi-test',
    icon: <PianoIcon />,
    enabled: true,
    note: 'Check that your piano is connected.',
  },
]

export function SettingsScreen() {
  return (
    <>
      <h1>Settings</h1>
      <div className="card-grid">
        {TOOLS.map((tool) => {
          const body = (
            <>
              <span className="tile-icon">{tool.icon}</span>
              <h2>{tool.label}</h2>
              <p>{tool.note}</p>
            </>
          )
          return tool.enabled ? (
            <Link key={tool.to} to={tool.to} className="card">
              {body}
            </Link>
          ) : (
            <div key={tool.to} className="card disabled" role="link" aria-disabled="true">
              {body}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function NotFoundScreen() {
  return (
    <>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </>
  )
}
