/**
 * Maps the audio clock (AudioContext time, seconds) onto `performance.now()` (ms).
 *
 * Feed it pairs from `AudioContext.getOutputTimestamp()`. The offset
 * (performanceMs - contextTime*1000) is estimated as the median of recent samples, which
 * shrugs off scheduling hiccups. `jitterMs` reports how noisy that estimate is, which is the
 * mapping error this class can measure by itself. The absolute input latency (mic to
 * speaker/ADC path) is separate and is measured by the calibration latency test (PD-311).
 */
export class ClockMap {
  private offsets: number[] = []

  private readonly maxSamples: number

  constructor(maxSamples = 200) {
    this.maxSamples = maxSamples
  }

  addSample(contextTimeSec: number, performanceMs: number): void {
    this.offsets.push(performanceMs - contextTimeSec * 1000)
    if (this.offsets.length > this.maxSamples) this.offsets.shift()
  }

  get count(): number {
    return this.offsets.length
  }

  /** Median offset in ms, or null before any sample. */
  get offsetMs(): number | null {
    if (this.offsets.length === 0) return null
    const s = [...this.offsets].sort((a, b) => a - b)
    const mid = s.length >> 1
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
  }

  toPerformanceMs(contextTimeSec: number): number | null {
    const o = this.offsetMs
    return o === null ? null : contextTimeSec * 1000 + o
  }

  toContextTimeSec(performanceMs: number): number | null {
    const o = this.offsetMs
    return o === null ? null : (performanceMs - o) / 1000
  }

  /** Spread of the offset estimates: standard deviation and worst deviation from the median, in ms. */
  stats(): { count: number; offsetMs: number | null; stdDevMs: number; maxDeviationMs: number } {
    const median = this.offsetMs
    if (median === null) return { count: 0, offsetMs: null, stdDevMs: 0, maxDeviationMs: 0 }
    const devs = this.offsets.map((o) => o - median)
    const mean = this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length
    const variance = this.offsets.reduce((a, o) => a + (o - mean) ** 2, 0) / this.offsets.length
    return {
      count: this.offsets.length,
      offsetMs: median,
      stdDevMs: Math.sqrt(variance),
      maxDeviationMs: Math.max(...devs.map(Math.abs)),
    }
  }

  reset(): void {
    this.offsets = []
  }
}
