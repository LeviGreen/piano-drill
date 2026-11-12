import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connectMidi,
  createDrillInput,
  loadInputChoice,
  pianoConnected,
  PIANO_BACK_MESSAGE,
  PIANO_LOST_MESSAGE,
  saveInputChoice,
  type DrillInput,
  type InputChoice,
} from '../audio/inputs/drillInput'
import type { MidiInput, RequestMidiAccess } from '../audio/inputs/MidiInput'

/**
 * What a drill screen needs to take notes from the chosen input (PD-314): the remembered choice, opening the input
 * before a session (reporting a missing piano at once, in words), and watching a MIDI piano during the session so that
 * unplugging it pauses the drill instead of leaving it waiting for notes that cannot come.
 */
export function usePianoInput(opts: {
  /** For tests: stands in for the browser's MIDI request. */
  requestAccess?: RequestMidiAccess | null
  /** Called when the piano goes away during a session (so the screen can pause). */
  onLost: () => void
}) {
  const [choice, setChoiceState] = useState<InputChoice>(loadInputChoice)
  const [problem, setProblem] = useState<string | null>(null)
  const [lost, setLost] = useState(false)
  const [back, setBack] = useState(false)
  const [starting, setStarting] = useState(false)
  const watching = useRef<(() => void) | null>(null)
  const onLost = useRef(opts.onLost)
  useEffect(() => {
    onLost.current = opts.onLost
  })

  /** Stop watching the piano (when a session ends or the screen goes away). */
  const release = useCallback(() => {
    watching.current?.()
    watching.current = null
  }, [])
  useEffect(() => release, [release])

  const setChoice = (c: InputChoice) => {
    setChoiceState(c)
    saveInputChoice(c)
    setProblem(null)
  }

  /** Open the chosen input. Null if it could not be opened; `problem` then says why. */
  const open = async (): Promise<DrillInput | null> => {
    release()
    setProblem(null)
    setLost(false)
    setBack(false)
    const drill = createDrillInput(choice, { requestAccess: opts.requestAccess })
    if (drill.midi) {
      setStarting(true)
      try {
        await connectMidi(drill.midi)
      } catch (e) {
        setProblem(e instanceof Error ? e.message : String(e))
        return null
      } finally {
        setStarting(false)
      }
      watch(drill.midi)
    }
    return drill
  }

  const watch = (midi: MidiInput) => {
    let ok = true
    watching.current = midi.onChange(() => {
      const now = pianoConnected(midi)
      if (now === ok) return
      ok = now
      setLost(!now)
      if (!now) onLost.current()
      else setBack(true)
    })
  }

  /** The piano is back and the player has pressed Resume: stop saying so. */
  const acknowledge = () => setBack(false)

  const notice = problem ?? (lost ? PIANO_LOST_MESSAGE : back ? PIANO_BACK_MESSAGE : null)
  return { choice, setChoice, notice, lost, starting, open, release, acknowledge }
}
