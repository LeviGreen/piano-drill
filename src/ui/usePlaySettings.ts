import { useState } from 'react'
import { PRESET_LEVELS } from '../levels/presets'
import {
  mergeSettings,
  parseKeyName,
  parseSettings,
  type DifficultySettings,
} from '../levels/settings'
import { loadJsonPref, loadPref, PREF_KEYS, saveJsonPref, savePref } from '../storage/prefs'
import { keyName, keySignature } from '../theory/keys'

type Loaded = { settings: DifficultySettings; levelId: number | 'custom' }

/** The settings and level picked last time, or level 1. */
function loadSettings(): Loaded {
  const saved = loadJsonPref(PREF_KEYS.playSettings) as
    { levelId?: unknown; settings?: unknown } | undefined
  const parsed = parseSettings(saved?.settings)
  if (saved && parsed.ok) {
    const known = PRESET_LEVELS.some((l) => l.id === saved.levelId)
    return { settings: parsed.settings, levelId: known ? (saved.levelId as number) : 'custom' }
  }
  return { settings: PRESET_LEVELS[0].settings, levelId: PRESET_LEVELS[0].id }
}

/** The sharps/flats of the one key signature the settings are set to, or null when they draw from several keys. */
export const oneKeySignature = (s: DifficultySettings): number | null => {
  const name = s.keys.explicit?.[0]
  return name === undefined ? null : (parseKeyName(name)?.accidentals ?? null)
}

/** The key signature last picked for "One key signature", so switching away and back remembers it. */
function loadLastSignature(settings: DifficultySettings): number {
  const now = oneKeySignature(settings)
  if (now !== null) return now
  const n = Number(loadPref(PREF_KEYS.playOneKey))
  return Number.isInteger(n) && n >= -7 && n <= 7 ? n : 0
}

/**
 * The Sight-Read settings and the level picked, remembered between visits: changing an option makes the level "Custom",
 * picking a level fills the options in, and "one key signature" is a shortcut for a key and its relative minor.
 */
export function usePlaySettings() {
  const [initial] = useState(loadSettings)
  const [settings, setSettings] = useState<DifficultySettings>(initial.settings)
  const [levelId, setLevelId] = useState<number | 'custom'>(initial.levelId)
  const [lastSignature, setLastSignature] = useState(() => loadLastSignature(initial.settings))

  const change = (next: DifficultySettings, id: number | 'custom') => {
    setSettings(next)
    setLevelId(id)
    saveJsonPref(PREF_KEYS.playSettings, { levelId: id, settings: next })
  }
  /** Change some options by hand: the settings stay valid and the level picker goes to "Custom". */
  const edit = (patch: Record<string, unknown>) => {
    const r = mergeSettings(settings, patch)
    if (r.ok) change({ ...r.settings, name: 'Custom' }, 'custom')
  }
  /** One key signature: the major key and its relative minor, so notes, intervals and chords come from both. */
  const pickSignature = (n: number) => {
    setLastSignature(n)
    savePref(PREF_KEYS.playOneKey, String(n))
    edit({
      keys: { explicit: [keyName(keySignature(n, 'major')), keyName(keySignature(n, 'minor'))] },
    })
  }
  const pickKeyChoice = (value: string) => {
    if (value === 'one') return pickSignature(lastSignature)
    const { explicit: _gone, ...keys } = settings.keys
    const r = parseSettings({ ...settings, name: 'Custom', keys })
    if (r.ok) change(r.settings, 'custom')
  }
  const pickLevel = (value: string) => {
    if (value === 'custom') return setLevelId('custom')
    const picked = PRESET_LEVELS.find((l) => l.id === Number(value))
    if (picked) change(picked.settings, picked.id)
  }

  return {
    settings,
    levelId,
    level: PRESET_LEVELS.find((l) => l.id === levelId),
    /** Sharps/flats of the one key signature in use, or null for several keys. */
    signature: oneKeySignature(settings),
    lastSignature,
    edit,
    pickLevel,
    pickSignature,
    pickKeyChoice,
  }
}
