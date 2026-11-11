import { Link, NavLink, Outlet } from 'react-router'
import { NAV_ITEMS } from './nav'
import { THEMES, useTheme, type Theme } from './theme'

export function AppShell() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="brand">
          Piano Drill
        </Link>
        <label className="theme-picker">
          Theme
          <select value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <nav className="nav" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="screen">
        <Outlet />
      </main>
    </div>
  )
}
