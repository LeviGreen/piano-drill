import { keyName, type KeySignature } from './keys'
import { pick, type Rng } from './random'

/**
 * Chooses keys uniformly, but never more than `maxRun` times in a row (when there is more than one
 * key). Shared by the one-hand and two-hand generators.
 */
export class KeyRotation {
  private readonly keys: KeySignature[]
  private readonly maxRun: number
  private readonly rng: Rng
  private last = ''
  private run = 0

  constructor(keys: KeySignature[], maxRun: number, rng: Rng) {
    this.keys = keys
    this.maxRun = maxRun
    this.rng = rng
  }

  choose(): KeySignature {
    const mustChange = this.keys.length > 1 && this.run >= this.maxRun
    const pool = mustChange ? this.keys.filter((k) => keyName(k) !== this.last) : this.keys
    return pick(this.rng, pool)
  }

  /** Record that a target in `key` was actually used. */
  commit(key: KeySignature): void {
    const name = keyName(key)
    this.run = name === this.last ? this.run + 1 : 1
    this.last = name
  }
}
