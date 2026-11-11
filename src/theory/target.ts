import type { KeySignature } from './keys'
import type { Pitch } from './pitch'
import type { Clef } from './staff'

export type Hand = 'LH' | 'RH'
export type ContentType = 'note' | 'interval' | 'triad' | 'seventh'

export type HandPart = {
  hand: Hand
  clef: Clef
  /** Sorted low to high. */
  pitches: Pitch[]
  /** e.g. "Dm/F", for feedback and debugging. */
  label?: string
}

/** What the drill flashes: one or two hand parts in a key (design §4.1). */
export type Target = {
  id: string
  key: KeySignature
  parts: HandPart[]
  content: {
    type: ContentType
    quality?: string
    inversion?: number
    /** Scale degree (1..7) the chord was built on, when it is a chord. */
    degree?: number
  }
}
