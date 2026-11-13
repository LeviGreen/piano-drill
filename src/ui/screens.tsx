import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { NAV_ITEMS } from './nav'

const DESCRIPTIONS: Record<string, string> = {
  '/play': 'Flash a chord or interval, play it, beat the clock.',
  '/key-id': 'Name the key signature as fast as you can.',
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

/** A microphone. */
const MicIcon = () => (
  <svg {...iconProps}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" />
  </svg>
)

/** A record button. */
const RecordIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
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
  {
    label: 'Mic Test',
    to: '/settings/mic-test',
    icon: <MicIcon />,
    enabled: false,
    note: 'Shelved for now.',
  },
  {
    label: 'Corpus Recorder',
    to: '/settings/corpus-recorder',
    icon: <RecordIcon />,
    enabled: false,
    note: 'Shelved for now.',
  },
]

export function SettingsScreen() {
  return (
    <>
      <Placeholder title="Settings" ticket="PD-703" />
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
