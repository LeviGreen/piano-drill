/** In-place iterative radix-2 complex FFT with precomputed twiddles and bit-reversal table. */
export class FFT {
  readonly size: number
  private readonly cosT: Float64Array
  private readonly sinT: Float64Array
  private readonly rev: Uint32Array

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0)
      throw new RangeError(`FFT size must be a power of two: ${size}`)
    this.size = size
    this.cosT = new Float64Array(size / 2)
    this.sinT = new Float64Array(size / 2)
    for (let k = 0; k < size / 2; k++) {
      this.cosT[k] = Math.cos((2 * Math.PI * k) / size)
      this.sinT[k] = -Math.sin((2 * Math.PI * k) / size) // forward transform: e^{-i...}
    }
    this.rev = new Uint32Array(size)
    const bits = Math.log2(size)
    for (let i = 0; i < size; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
      this.rev[i] = r
    }
  }

  /** Forward transform of (re, im), in place. Both arrays must have length `size`. */
  forward(re: Float64Array, im: Float64Array): void {
    const n = this.size
    for (let i = 0; i < n; i++) {
      const j = this.rev[i]
      if (j > i) {
        let t = re[i]
        re[i] = re[j]
        re[j] = t
        t = im[i]
        im[i] = im[j]
        im[j] = t
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1
      const step = n / len
      for (let start = 0; start < n; start += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = start + j
          const b = a + half
          const wr = this.cosT[k]
          const wi = this.sinT[k]
          const tr = wr * re[b] - wi * im[b]
          const ti = wr * im[b] + wi * re[b]
          re[b] = re[a] - tr
          im[b] = im[a] - ti
          re[a] += tr
          im[a] += ti
        }
      }
    }
  }
}
