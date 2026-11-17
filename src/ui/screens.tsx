import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { loadInputChoice, saveInputChoice } from '../audio/inputs/drillInput'
import { InputChoiceField } from './InputChoiceField'
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

function Placeholder({ title, ticket }: { title: string; ticket: string }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="placeholder">Coming soon (see {ticket} in docs/tickets.md).</p>
    </>
  )
}

const iconProps = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** A piano keyboard. */
const PianoIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M9 5v14M15 5v14" />
    <path d="M7 5v7M13 5v7M19 5v7" strokeWidth="3" />
  </svg>
)

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
  // The same remembered choice that Sight-Read uses; Key Signatures' MIDI view needs the MIDI piano chosen here.
  const [choice, setChoice] = useState(loadInputChoice)
  return (
    <>
      <Placeholder title="Settings" ticket="PD-703" />
      <div className="settings-fields">
        <InputChoiceField
          value={choice}
          onChange={(c) => {
            setChoice(c)
            saveInputChoice(c)
          }}
        />
      </div>
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
