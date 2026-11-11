/**
 * Fixed-capacity ring buffer of mono samples addressed by absolute frame number
 * (frame 0 = first sample ever written), so the analysis code can ask for
 * "the samples around frame N" without caring about wrap-around.
 */
export class RingBuffer {
  private readonly data: Float32Array
  private written = 0

  readonly capacity: number

  constructor(capacity: number) {
    this.capacity = capacity
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be >= 1')
    this.data = new Float32Array(capacity)
  }

  /** Total number of frames ever written. */
  get totalWritten(): number {
    return this.written
  }

  /** Oldest frame still held. */
  get oldestFrame(): number {
    return Math.max(0, this.written - this.capacity)
  }

  write(samples: Float32Array): void {
    let src = samples
    let skipped = 0
    if (src.length > this.capacity) {
      skipped = src.length - this.capacity
      src = src.subarray(skipped)
    }
    const start = (this.written + skipped) % this.capacity
    const firstPart = Math.min(src.length, this.capacity - start)
    this.data.set(src.subarray(0, firstPart), start)
    this.data.set(src.subarray(firstPart), 0)
    this.written += samples.length
  }

  /** Copy of `length` frames starting at absolute frame `startFrame`, or null if not (fully) available. */
  read(startFrame: number, length: number): Float32Array | null {
    if (length < 0 || startFrame < this.oldestFrame || startFrame + length > this.written)
      return null
    const out = new Float32Array(length)
    const start = startFrame % this.capacity
    const firstPart = Math.min(length, this.capacity - start)
    out.set(this.data.subarray(start, start + firstPart), 0)
    out.set(this.data.subarray(0, length - firstPart), firstPart)
    return out
  }

  /** The most recent `length` frames (fewer if not that many have been written). */
  latest(length: number): Float32Array {
    const n = Math.min(length, this.written, this.capacity)
    return this.read(this.written - n, n) as Float32Array
  }
}
