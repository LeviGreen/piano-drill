import { useState } from 'react'
import { KEY_ID_LEVELS } from '../keyid/presets'
import { mergeKeyIdSettings, parseKeyIdSettings, type KeyIdSettings } from '../keyid/settings'
import { loadJsonPref, PREF_KEYS, saveJsonPref } from '../storage/prefs'

type Loaded = { settings: KeyIdSettings; levelId: number | 'custom' }

/** The settings picked last time, or level 1. */
function loadSettings(): Loaded {
  const saved = loadJsonPref(PREF_KEYS.keyIdSettings)
  const parsed = parseKeyIdSettings(saved)
  if (saved !== undefined && parsed.ok) {
    // Changing any option renames the settings "Custom", so a preset's own name means it is still that level.
    const preset = KEY_ID_LEVELS.find((l) => l.settings.name === parsed.settings.name)
    return { settings: parsed.settings, levelId: preset?.id ?? 'custom' }
  }
  return { settings: KEY_ID_LEVELS[0].settings, levelId: KEY_ID_LEVELS[0].id }
}

/** The Key Signatures settings and level, remembered between visits (changing an option makes the level "Custom"). */
export function useKeyIdSettings() {
  const [initial] = useState(loadSettings)
  /** What the screen plays with. The window edits `draft`; Save copies it here, anything else throws it away. */
  const [saved, setSaved] = useState<Loaded>(initial)
  const [draft, setDraft] = useState<Loaded>(initial)

  const change = (next: KeyIdSettings, level: number | 'custom') =>
    setDraft({ settings: next, levelId: level })
  const edit = (patch: Record<string, unknown>) => {
    const r = mergeKeyIdSettings(draft.settings, patch)
    if (r.ok) change({ ...r.settings, name: 'Custom' }, 'custom')
  }
  const pickLevel = (value: string) => {
    if (value === 'custom') return setDraft({ ...draft, levelId: 'custom' })
    const picked = KEY_ID_LEVELS.find((l) => l.id === Number(value))
    if (picked) change(picked.settings, picked.id)
  }
  /** Keep the draft, and remember it for next time. */
  const save = () => {
    setSaved(draft)
    saveJsonPref(PREF_KEYS.keyIdSettings, draft.settings)
  }
  /** Drop the draft: the window opens again on what was saved. */
  const discard = () => setDraft(saved)

  return { settings: saved.settings, levelId: saved.levelId, draft, edit, pickLevel, save, discard }
}
