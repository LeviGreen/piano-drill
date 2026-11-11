import { Link } from 'react-router'
import { NAV_ITEMS } from './nav'

const DESCRIPTIONS: Record<string, string> = {
  '/play': 'Flash a chord or interval, play it, beat the clock.',
  '/key-id': 'Name the key signature as fast as you can.',
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

export const PlayScreen = () => <Placeholder title="Play" ticket="PD-402" />
export const KeyIdScreen = () => <Placeholder title="Key ID" ticket="PD-503" />
export function SettingsScreen() {
  return (
    <>
      <Placeholder title="Settings" ticket="PD-703" />
      <p>
        <Link to="/settings/mic-test">Mic test</Link>
      </p>
      <p>
        <Link to="/settings/corpus-recorder">Corpus recorder</Link>
      </p>
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
