import { loadPresets, presetById, type Preset } from '../settings/presets'
import levelData from './levels.json'
import { parseKeyIdSettings, type KeyIdSettings } from './settings'

export type KeyIdLevel = Preset<KeyIdSettings>

/**
 * The preset key-ID levels, loaded from levels.json (data, not code) and validated when this module loads, so a bad
 * edit fails immediately with a readable message.
 */
export const KEY_ID_LEVELS: KeyIdLevel[] = loadPresets(
  levelData,
  parseKeyIdSettings,
  'keyid/levels.json',
)

export const keyIdLevelById = (id: number): KeyIdLevel =>
  presetById(KEY_ID_LEVELS, id, 'key-ID level')
