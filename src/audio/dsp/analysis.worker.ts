/// Web Worker host for SpectralAnalyzer: keeps FFT work off the main thread.
import { SpectralAnalyzer, type OnsetEvent } from './SpectralAnalyzer'

export type WorkerIn =
  | { type: 'init'; sampleRate: number }
  | { type: 'samples'; startFrame: number; samples: Float32Array }

export type WorkerOut = {
  type: 'result'
  onsets: OnsetEvent[]
  /** Analysis steps run for this batch and the time they took (ms), for the per-frame budget. */
  frames: number
  ms: number
}

let analyzer: SpectralAnalyzer | null = null

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data
  if (msg.type === 'init') {
    analyzer = new SpectralAnalyzer({ sampleRate: msg.sampleRate })
    return
  }
  if (!analyzer) return
  const t0 = performance.now()
  const frames = analyzer.push(msg.samples, msg.startFrame)
  const ms = performance.now() - t0
  const out: WorkerOut = {
    type: 'result',
    onsets: frames.flatMap((f) => f.onsets),
    frames: frames.length,
    ms,
  }
  ;(self as unknown as Worker).postMessage(out)
}
