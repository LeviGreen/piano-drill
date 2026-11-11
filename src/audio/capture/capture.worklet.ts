/// AudioWorklet module: runs on the audio rendering thread. Batches input into BATCH-sample
/// chunks (a multiple of the 128-frame render quantum) and posts them to the main thread with
/// the absolute frame number of the first sample, so the main thread can place them on the
/// audio clock exactly.
export {}

declare const currentFrame: number
declare class AudioWorkletProcessor {
  readonly port: MessagePort
  constructor()
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void

const BATCH = 512

class CaptureProcessor extends AudioWorkletProcessor {
  private buf = new Float32Array(BATCH)
  private n = 0
  private startFrame = 0

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0]
    if (!channel) return true
    if (this.n === 0) this.startFrame = currentFrame
    this.buf.set(channel, this.n)
    this.n += channel.length
    if (this.n >= BATCH) {
      let peak = 0
      let sumSq = 0
      for (let i = 0; i < BATCH; i++) {
        const v = this.buf[i]
        const a = Math.abs(v)
        if (a > peak) peak = a
        sumSq += v * v
      }
      const samples = this.buf
      this.port.postMessage(
        { startFrame: this.startFrame, samples, peak, rms: Math.sqrt(sumSq / BATCH) },
        [samples.buffer],
      )
      this.buf = new Float32Array(BATCH)
      this.n = 0
    }
    return true
  }
}

registerProcessor('capture-processor', CaptureProcessor)
