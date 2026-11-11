import { useEffect, useRef } from 'react'
import type { KeySignature } from '../theory/keys'
import type { Pitch } from '../theory/pitch'
import type { NoteState } from './overlays'
import { renderGrandStaff } from './renderGrandStaff'

export type GrandStaffProps = {
  keySignature: KeySignature
  rh?: Pitch[]
  lh?: Pitch[]
  showNames?: boolean
  rhStates?: (NoteState | undefined)[]
  lhStates?: (NoteState | undefined)[]
  ledgerRoom?: number
  label?: string
}

/** A grand staff (treble and bass joined by a brace) with the right- and left-hand notes. */
export function GrandStaff({
  keySignature,
  rh,
  lh,
  showNames,
  rhStates,
  lhStates,
  ledgerRoom,
  label,
}: GrandStaffProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current)
      renderGrandStaff(ref.current, {
        key: keySignature,
        rh,
        lh,
        showNames,
        rhStates,
        lhStates,
        ledgerRoom,
      })
  }, [keySignature, rh, lh, showNames, rhStates, lhStates, ledgerRoom])
  return <div ref={ref} className="staff" role="img" aria-label={label ?? 'grand staff'} />
}
