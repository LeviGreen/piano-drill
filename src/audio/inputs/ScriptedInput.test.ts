import { describe, expect, it } from 'vitest'
import type { NoteInputState } from './NoteInput'
import { ScriptedInput } from './ScriptedInput'

async function started() {
  const input = new ScriptedInput()
  const states: NoteInputState[] = []
  input.onUpdate((s) => states.push(s))
  await input.start()
  return { input, states }
}

describe('ScriptedInput', () => {
  it('emits onsets with the supplied timestamps and tracks active notes', async () => {
    const { input, states } = await started()
    input.noteOn(60, 100)
    input.noteOn(64, 120, 0.8)
    expect(states).toHaveLength(2)
    expect(states[0].onsets).toEqual([{ midi: 60, t: 100, confidence: 1 }])
    expect(states[1].t).toBe(120)
    expect([...states[1].activeNotes]).toEqual([
      [60, 1],
      [64, 0.8],
    ])
  })

  it('removes notes on noteOff and ignores unknown noteOff', async () => {
    const { input, states } = await started()
    input.noteOn(60, 0)
    input.noteOff(60, 50)
    input.noteOff(60, 60)
    expect(states).toHaveLength(2)
    expect(states[1].activeNotes.size).toBe(0)
    expect(states[1].onsets).toEqual([])
  })

  it('ignores events while stopped and clears notes on stop', async () => {
    const input = new ScriptedInput()
    const states: NoteInputState[] = []
    input.onUpdate((s) => states.push(s))
    input.noteOn(60, 0)
    expect(states).toHaveLength(0)
    await input.start()
    input.noteOn(60, 1)
    input.stop()
    input.noteOn(62, 2)
    await input.start()
    input.noteOn(64, 3)
    expect([...states[states.length - 1].activeNotes.keys()]).toEqual([64])
  })

  it('plays a script in timestamp order', async () => {
    const { input, states } = await started()
    input.play([
      { type: 'on', midi: 64, t: 30 },
      { type: 'on', midi: 60, t: 10 },
      { type: 'off', midi: 60, t: 20 },
    ])
    expect(states.map((s) => s.t)).toEqual([10, 20, 30])
  })

  it('snapshots are not mutated by later events, and unsubscribe works', async () => {
    const { input, states } = await started()
    let calls = 0
    const off = input.onUpdate(() => calls++)
    input.noteOn(60, 0)
    const first = states[0]
    input.noteOn(62, 1)
    expect(first.activeNotes.size).toBe(1)
    off()
    input.noteOn(64, 2)
    expect(calls).toBe(2)
  })
})
