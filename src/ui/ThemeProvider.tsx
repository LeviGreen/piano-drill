import { useEffect, useState, type ReactNode } from 'react'
import { ThemeContext, THEME_STORAGE_KEY, loadTheme, type Theme } from './theme'

// Home of the theme preference (RF-201 may move it into the shared preferences helper).
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(loadTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // Storage unavailable (private mode etc.): theme still applies for this session.
    }
  }, [theme])

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}
