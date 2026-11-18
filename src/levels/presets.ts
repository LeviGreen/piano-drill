import { loadPresets, presetById, type Preset } from '../settings/presets'
import levelData from './levels.json'
import { parseSettings, type DifficultySettings } from './settings'

export type Level = Preset<DifficultySettings>

/**
 * The 10 preset levels (design §3.1, adapted to the MVP range C2-C6: one ledger line for levels 1 and 2, two for levels 3 to 10), loaded from levels.json. Every level
 * is validated when this module loads, so a bad edit to the JSON fails immediately and with a readable error.
 */
export const PRESET_LEVELS: Level[] = loadPresets(levelData, parseSettings, 'levels.json')

export const levelById = (id: number): Level => presetById(PRESET_LEVELS, id)
