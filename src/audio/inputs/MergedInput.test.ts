import { describe, expect, it } from 'vitest'
import { MergedInput } from './MergedInput'
import type { NoteInputState } from './NoteInput'
import { ScriptedInput } from './ScriptedInput'

async function rig() {
  const a = new ScriptedInput()
  const b = new ScriptedInput()
  const merged = new MergedInput([a, b])
  const states: NoteInputState[] = []
  merged.onUpdate((s) => states.push(s))
  await merged.start()
  return { a, b, merged, states, last: () => states.at(-1)! }
}
const held = (s: NoteInputState) => [...s.activeNotes.keys()].sort((x, y) => x - y)

describe('two inputs heard as one', () => {
  it('a note played on either is an onset, and the notes held on both add up', async () => {
    const { a, b, last, states } = await rig()
    a.noteOn(60, 1)
    expect(last().onsets).toEqual([{ midi: 60, t: 1, confidence: 1 }])
    b.noteOn(64, 2)
    expect(last().onsets).toEqual([{ midi: 64, t: 2, confidence: 1 }])
    expect(held(last())).toEqual([60, 64])
    expect(states).toHaveLength(2)
  })

  it("a release on one input only releases that input's note, and the same note on both stays held until both let go", async () => {
    const { a, b, last } = await rig()
    a.noteOn(60, 1)
    b.noteOn(60, 2)
    a.noteOff(60, 3)
    expect(held(last())).toEqual([60]) // still held on the other
    b.noteOff(60, 4)
    expect(held(last())).toEqual([])
  })

  it('stopping releases everything on every input', async () => {
    const { a, b, merged, last } = await rig()
    a.noteOn(60, 1)
    b.noteOn(64, 2)
    merged.stop()
    a.noteOn(62, 3) // stopped inputs ignore notes
    expect(held(last())).toEqual([60, 64]) // the last state before stopping is not redelivered
    const again = new MergedInput([a, b])
    await again.start()
    const seen: NoteInputState[] = []
    again.onUpdate((s) => seen.push(s))
    a.noteOn(65, 4)
    expect(held(seen.at(-1)!)).toEqual([65])
  })

  it('stops listening for a listener that unsubscribes', async () => {
    const { a, merged } = await rig()
    const seen: number[] = []
    const off = merged.onUpdate((s) => seen.push(s.onsets.length))
    a.noteOn(60, 1)
    off()
    a.noteOn(62, 2)
    expect(seen).toEqual([1])
  })

  it('if one input cannot start, the ones already started are stopped again and the error is passed on', async () => {
    const a = new ScriptedInput()
    const failing = {
      onUpdate: () => () => {},
      start: () => Promise.reject(new Error('no piano')),
      stop: () => {},
    }
    const merged = new MergedInput([a, failing])
    await expect(merged.start()).rejects.toThrow('no piano')
    const seen: NoteInputState[] = []
    merged.onUpdate((s) => seen.push(s))
    a.noteOn(60, 1) // a was stopped, so it ignores the note
    expect(seen).toEqual([])
  })
})
