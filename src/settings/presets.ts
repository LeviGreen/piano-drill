import { type ParseResult } from './schema'

/** A preset level: its number, names and settings. Every mode's levels have this shape. */
export type Preset<S> = { id: number; name: string; description: string; settings: S }

/**
 * Load a mode's preset levels from its JSON data, checking each one with the mode's `parse` when the module loads,
 * so a bad edit to the JSON fails at once with a readable message. `source` names the file in that message.
 */
export function loadPresets<S>(
  data: { id: number; name: string; description: string; settings: unknown }[],
  parse: (input: unknown) => ParseResult<S>,
  source: string,
): Preset<S>[] {
  return data.map((l) => {
    const parsed = parse(l.settings)
    if (!parsed.ok) throw new Error(`${source}, level ${l.id}:\n  ${parsed.errors.join('\n  ')}`)
    return { id: l.id, name: l.name, description: l.description, settings: parsed.settings }
  })
}

/** Look a level up by its number; `what` names the kind of level in the error ("level", "key-ID level"). */
export function presetById<S>(presets: Preset<S>[], id: number, what = 'level'): Preset<S> {
  const level = presets.find((l) => l.id === id)
  if (!level) throw new RangeError(`No ${what} ${id}`)
  return level
}
