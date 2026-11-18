import { createContext, useContext } from 'react'
import { loadPref, PREF_KEYS } from '../storage/prefs'

export type Theme = 'system' | 'light' | 'dark' | 'high-contrast'

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'high-contrast', label: 'High contrast' },
]

export const THEME_STORAGE_KEY = PREF_KEYS.theme

function isTheme(v: unknown): v is Theme {
  return THEMES.some((t) => t.value === v)
}

export function loadTheme(): Theme {
  const v = loadPref(PREF_KEYS.theme)
  return isTheme(v) ? v : 'system'
}

export type ThemeContextValue = { theme: Theme; setTheme: (t: Theme) => void }

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
