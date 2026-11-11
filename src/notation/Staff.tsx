import { useEffect, useRef } from 'react'
import type { KeySignature } from '../theory/keys'
import type { Pitch } from '../theory/pitch'
import type { Clef } from '../theory/staff'
import type { NoteState } from './overlays'
import { renderStaff } from './renderStaff'

export type StaffProps = {
  clef: Clef
  keySignature: KeySignature
  notes?: Pitch[]
  showNames?: boolean
  states?: (NoteState | undefined)[]
  ledgerRoom?: number
  /** Accessible description. */
  label?: string
}

/** A single staff with clef, key signature and optional notes. */
export function Staff({
  clef,
  keySignature,
  notes,
  showNames,
  states,
  ledgerRoom,
  label,
}: StaffProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current)
      renderStaff(ref.current, { clef, key: keySignature, notes, showNames, states, ledgerRoom })
  }, [clef, keySignature, notes, showNames, states, ledgerRoom])
  return <div ref={ref} className="staff" role="img" aria-label={label ?? `${clef} clef staff`} />
}
