import { describe, expect, it } from 'vitest'
import type { NoteInputState } from './NoteInput'
import { OnScreenKeyboardInput } from './OnScreenKeyboardInput'

async function rig() {
  const input = new OnScreenKeyboardInput()
  const states: NoteInputState[] = []
  input.onUpdate((s) => states.push(s))
  await input.start()
  return { input, states, last: () => states.at(-1)! }
}

describe('on-screen keyboard input', () => {
  it('a chord held with several fingers gives the combined set of active notes', async () => {
    const { input, last } = await rig()
    input.press(60)
    input.press(64)
    input.press(67)
    expect([...last().activeNotes.keys()].sort()).toEqual([60, 64, 67])
    input.release(64)
    expect([...last().activeNotes.keys()].sort()).toEqual([60, 67])
  })

  it('each press is one onset, stamped with the time', async () => {
    const { input, states } = await rig()
    input.press(60)
    expect(states[0].onsets).toHaveLength(1)
    expect(states[0].onsets[0].midi).toBe(60)
    expect(states[0].onsets[0].t).toBeGreaterThan(0)
  })

  it('a key stays down until the last finger on it lets go, and a second finger is not a new onset', async () => {
    const { input, states, last } = await rig()
    input.press(60)
    input.press(60)
    expect(states.filter((s) => s.onsets.length > 0)).toHaveLength(1)
    input.release(60)
    expect(last().activeNotes.has(60)).toBe(true)
    input.release(60)
    expect(last().activeNotes.has(60)).toBe(false)
  })

  it('ignores releases of keys that are not down, and presses while stopped', async () => {
    const { input, states } = await rig()
    input.release(60)
    expect(states).toHaveLength(0)
    input.stop()
    input.press(60)
    expect(states).toHaveLength(0)
  })
})
