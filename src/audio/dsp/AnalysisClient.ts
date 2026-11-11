import type { OnsetEvent } from './SpectralAnalyzer'
import type { WorkerIn, WorkerOut } from './analysis.worker'

export type AnalysisStats = { frames: number; avgMsPerFrame: number; maxMsPerFrame: number }

/** Main-thread handle to the analysis worker. */
export class AnalysisClient {
  private readonly worker: Worker
  private readonly listeners = new Set<(o: OnsetEvent) => void>()
  private frames = 0
  private totalMs = 0
  private maxMsPerFrame = 0

  constructor(sampleRate: number) {
    this.worker = new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const r = e.data
      if (r.frames > 0) {
        this.frames += r.frames
        this.totalMs += r.ms
        this.maxMsPerFrame = Math.max(this.maxMsPerFrame, r.ms / r.frames)
      }
      for (const o of r.onsets) for (const cb of this.listeners) cb(o)
    }
    this.post({ type: 'init', sampleRate })
  }

  /** Send a batch of samples; `startFrame` is the absolute frame index of samples[0]. */
  push(startFrame: number, samples: Float32Array): void {
    const copy = samples.slice() // the caller keeps its array (it also feeds the ring buffer)
    this.worker.postMessage({ type: 'samples', startFrame, samples: copy } satisfies WorkerIn, [
      copy.buffer,
    ])
  }

  onOnset(cb: (o: OnsetEvent) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  get stats(): AnalysisStats {
    return {
      frames: this.frames,
      avgMsPerFrame: this.frames ? this.totalMs / this.frames : 0,
      maxMsPerFrame: this.maxMsPerFrame,
    }
  }

  terminate(): void {
    this.worker.terminate()
    this.listeners.clear()
  }

  private post(msg: WorkerIn): void {
    this.worker.postMessage(msg)
  }
}
