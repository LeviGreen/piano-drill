import levelData from './levels.json'
import { parseKeyIdSettings, type KeyIdSettings } from './settings'

export type KeyIdLevel = { id: number; name: string; description: string; settings: KeyIdSettings }

/**
 * The preset key-ID levels, loaded from levels.json (data, not code) and validated when this module loads, so a bad
 * edit fails immediately with a readable message.
 */
export const KEY_ID_LEVELS: KeyIdLevel[] = (
  levelData as { id: number; name: string; description: string; settings: unknown }[]
).map((l) => {
  const parsed = parseKeyIdSettings(l.settings)
  if (!parsed.ok)
    throw new Error(`keyid/levels.json, level ${l.id}:\n  ${parsed.errors.join('\n  ')}`)
  return { id: l.id, name: l.name, description: l.description, settings: parsed.settings }
})

export const keyIdLevelById = (id: number): KeyIdLevel => {
  const level = KEY_ID_LEVELS.find((l) => l.id === id)
  if (!level) throw new RangeError(`No key-ID level ${id}`)
  return level
}
