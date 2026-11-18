import { useEffect, useState, type ReactNode } from 'react'
import { PREF_KEYS, savePref } from '../storage/prefs'
import { ThemeContext, loadTheme, type Theme } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(loadTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    savePref(PREF_KEYS.theme, theme)
  }, [theme])

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}
