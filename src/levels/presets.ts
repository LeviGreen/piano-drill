import levelData from './levels.json'
import { parseSettings, type DifficultySettings } from './settings'

export type Level = { id: number; name: string; description: string; settings: DifficultySettings }

/**
 * The 10 preset levels (design §3.1, adapted to the MVP range C2-C6: one ledger line for levels 1 and 2, two for levels 3 to 10), loaded from levels.json. Every level
 * is validated when this module loads, so a bad edit to the JSON fails immediately and with a readable error.
 */
export const PRESET_LEVELS: Level[] = (
  levelData as { id: number; name: string; description: string; settings: unknown }[]
).map((l) => {
  const parsed = parseSettings(l.settings)
  if (!parsed.ok) throw new Error(`levels.json, level ${l.id}:\n  ${parsed.errors.join('\n  ')}`)
  return { id: l.id, name: l.name, description: l.description, settings: parsed.settings }
})

export const levelById = (id: number): Level => {
  const level = PRESET_LEVELS.find((l) => l.id === id)
  if (!level) throw new RangeError(`No level ${id}`)
  return level
}
