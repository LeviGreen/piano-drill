import workletUrl from './capture.worklet.ts?worker&url'
import { ClockMap } from './clockMap'
import { classifyMicError, MicError } from './micErrors'
import { RingBuffer } from './ringBuffer'

export type MicState = 'idle' | 'starting' | 'running' | 'error'
export type LevelReading = { peak: number; rms: number }
export type MicReport = {
  sampleRate: number
  baseLatencySec: number
  outputLatencySec: number
  /** What the browser actually applied; some browsers ignore the request to disable processing. */
  echoCancellation?: boolean | string
  noiseSuppression?: boolean | string
  autoGainControl?: boolean | string
  deviceLabel: string
}

const RING_SECONDS = 10

export async function listInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const all = await navigator.mediaDevices.enumerateDevices()
  return all.filter((d) => d.kind === 'audioinput')
}

/**
 * Microphone capture: getUserMedia with all voice processing OFF (it distorts musical signals),
 * an AudioWorklet that streams mono samples into a ring buffer, and a clock map from the audio
 * clock to performance.now().
 */
export class MicCapture {
  ring: RingBuffer | null = null
  readonly clock = new ClockMap()
  state: MicState = 'idle'
  error: MicError | null = null
  report: MicReport | null = null

  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private node: AudioWorkletNode | null = null
  private clockTimer: ReturnType<typeof setInterval> | null = null
  private levelListeners = new Set<(l: LevelReading) => void>()
  private stateListeners = new Set<() => void>()

  onLevel(cb: (l: LevelReading) => void): () => void {
    this.levelListeners.add(cb)
    return () => this.levelListeners.delete(cb)
  }

  onStateChange(cb: () => void): () => void {
    this.stateListeners.add(cb)
    return () => this.stateListeners.delete(cb)
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 0
  }

  /** Performance.now() time at which the given absolute frame was captured (before input-latency compensation). */
  frameToPerformanceMs(frame: number): number | null {
    return this.clock.toPerformanceMs(frame / this.sampleRate)
  }

  async start(deviceId?: string): Promise<void> {
    if (this.state === 'starting' || this.state === 'running') this.stop()
    this.setState('starting')
    try {
      if (!window.isSecureContext) throw new MicError('insecure', '')
      if (!navigator.mediaDevices?.getUserMedia || typeof AudioWorkletNode === 'undefined') {
        throw new MicError('unsupported', '')
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      this.ctx = ctx
      await ctx.resume()
      try {
        await ctx.audioWorklet.addModule(workletUrl)
      } catch {
        throw new MicError('worklet', '')
      }

      this.ring = new RingBuffer(Math.round(ctx.sampleRate * RING_SECONDS))
      const node = new AudioWorkletNode(ctx, 'capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
      })
      node.port.onmessage = (e: MessageEvent) => {
        const { samples, peak, rms } = e.data as {
          samples: Float32Array
          peak: number
          rms: number
        }
        this.ring?.write(samples)
        for (const cb of this.levelListeners) cb({ peak, rms })
      }
      // Route through a muted gain so the browser keeps pulling audio without playing the mic back.
      const mute = ctx.createGain()
      mute.gain.value = 0
      ctx.createMediaStreamSource(this.stream).connect(node).connect(mute).connect(ctx.destination)
      this.node = node

      this.clock.reset()
      this.sampleClock()
      this.clockTimer = setInterval(() => this.sampleClock(), 250)

      const track = this.stream.getAudioTracks()[0]
      const s = track.getSettings()
      this.report = {
        sampleRate: ctx.sampleRate,
        baseLatencySec: ctx.baseLatency,
        outputLatencySec: ctx.outputLatency ?? 0,
        echoCancellation: s.echoCancellation,
        noiseSuppression: s.noiseSuppression,
        autoGainControl: s.autoGainControl,
        deviceLabel: track.label,
      }
      // If the device disappears mid-session, surface it instead of silently going quiet.
      track.onended = () => this.fail(new MicError('no-device', ''))
      this.error = null
      this.setState('running')
    } catch (e) {
      this.fail(classifyMicError(e))
    }
  }

  stop(): void {
    if (this.clockTimer) clearInterval(this.clockTimer)
    this.clockTimer = null
    this.node?.disconnect()
    this.node = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    void this.ctx?.close()
    this.ctx = null
    if (this.state !== 'error') this.setState('idle')
  }

  private sampleClock(): void {
    if (!this.ctx) return
    const ts = this.ctx.getOutputTimestamp()
    // Both are 0 until the context has actually started rendering.
    if (ts.contextTime && ts.performanceTime)
      this.clock.addSample(ts.contextTime, ts.performanceTime)
  }

  private fail(error: MicError): void {
    this.error = error
    this.setState('error')
    this.stop()
  }

  private setState(s: MicState): void {
    this.state = s
    for (const cb of this.stateListeners) cb()
  }
}
