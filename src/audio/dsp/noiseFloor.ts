/**
 * Per-bin noise floor tracker: drops immediately to any quieter value and creeps upward slowly,
 * so sustained notes do not drag the floor up much but a genuinely louder room does, eventually.
 * Assumes the signal starts in (near) silence unless seeded via `seed()`.
 */
export class NoiseFloor {
  readonly floor: Float64Array
  private initialised = false

  /** @param riseFactor per-update growth cap; 1.001 per 5 ms hop is about 1.6 dB/s. */
  private readonly riseFactor: number

  constructor(binCount: number, riseFactor = 1.001) {
    this.floor = new Float64Array(binCount)
    this.riseFactor = riseFactor
  }

  /** Initialise from a measured silence spectrum (e.g. the calibration wizard's noise measurement). */
  seed(mags: ArrayLike<number>): void {
    for (let k = 0; k < this.floor.length; k++) this.floor[k] = mags[k]
    this.initialised = true
  }

  update(mags: ArrayLike<number>): void {
    if (!this.initialised) return this.seed(mags)
    const { floor, riseFactor } = this
    for (let k = 0; k < floor.length; k++) {
      const m = mags[k]
      floor[k] = m < floor[k] ? m : Math.min(m, floor[k] * riseFactor)
    }
  }
}
