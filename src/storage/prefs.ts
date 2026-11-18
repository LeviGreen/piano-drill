/**
 * Small remembered preferences (theme, input choice, last settings, initials) kept in the browser's localStorage. This
 * is the one place that touches it: storage can be missing or blocked (private windows, blocked site data), and then
 * a preference simply is not remembered and everything keeps working for the visit. Keys keep their original names, so
 * what was saved before is still found. Bigger data (scores, backups) lives in the database (`./index`).
 */

export const PREF_KEYS = {
  theme: 'piano-drill.theme',
  inputChoice: 'piano-drill.input',
  midiDevice: 'piano-drill.midi-device',
  initials: 'piano-drill.initials',
  playSettings: 'piano-drill.play-settings',
  playOneKey: 'piano-drill.play-one-key',
  keyIdSettings: 'piano-drill.keyid-settings',
} as const

/** The saved text, or null when nothing is saved or storage is unavailable. */
export function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Remember text; `null` forgets it. Quietly does nothing when storage is unavailable. */
export function savePref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Not remembered; the choice still applies for this visit.
  }
}

/** Saved JSON, or undefined when nothing is saved, storage is unavailable or the text is not JSON. */
export function loadJsonPref(key: string): unknown {
  const raw = loadPref(key)
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

export function saveJsonPref(key: string, value: unknown): void {
  savePref(key, JSON.stringify(value))
}
