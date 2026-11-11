import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { listInputDevices, MicCapture } from '../audio/capture/MicCapture'

const FLOOR_DB = -60
const toDb = (x: number) => (x > 0 ? Math.max(FLOOR_DB, 20 * Math.log10(x)) : FLOOR_DB)
const pct = (db: number) => `${((db - FLOOR_DB) / -FLOOR_DB) * 100}%`

/** Diagnostic screen for PD-304: start the mic, watch the level meter, inspect the clock mapping. */
export function MicTestScreen() {
  const [m] = useState(() => new MicCapture())
  const [, bump] = useState(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceId, setDeviceId] = useState('')
  const rmsBar = useRef<HTMLDivElement>(null)
  const peakMark = useRef<HTMLDivElement>(null)
  const dbText = useRef<HTMLSpanElement>(null)
  const clockText = useRef<HTMLPreElement>(null)
  const level = useRef({ peak: 0, rms: 0, peakHold: FLOOR_DB, holdAt: 0 })

  useEffect(() => {
    const offState = m.onStateChange(() => {
      bump((n) => n + 1)
      // Device labels only appear after permission is granted, so refresh the list.
      if (m.state === 'running') void listInputDevices().then(setDevices)
    })
    const offLevel = m.onLevel((l) => {
      level.current.peak = l.peak
      level.current.rms = l.rms
    })
    void listInputDevices().then(setDevices)
    let raf = 0
    const tick = () => {
      const lv = level.current
      const now = performance.now()
      const peakDb = toDb(lv.peak)
      if (peakDb >= lv.peakHold || now - lv.holdAt > 1000) {
        lv.peakHold = peakDb
        lv.holdAt = now
      }
      const rmsDb = toDb(lv.rms)
      if (rmsBar.current) rmsBar.current.style.width = pct(rmsDb)
      if (peakMark.current) peakMark.current.style.left = pct(lv.peakHold)
      if (dbText.current)
        dbText.current.textContent = `${rmsDb.toFixed(0)} dB (peak ${lv.peakHold.toFixed(0)} dB)`
      if (clockText.current) {
        const s = m.clock.stats()
        clockText.current.textContent =
          s.count === 0
            ? 'No clock samples yet.'
            : `samples: ${s.count}\noffset (perf - audio): ${s.offsetMs!.toFixed(2)} ms\njitter (std dev): ${s.stdDevMs.toFixed(3)} ms\nworst deviation: ${s.maxDeviationMs.toFixed(3)} ms`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      offState()
      offLevel()
      m.stop()
    }
  }, [m])

  const running = m.state === 'running'
  const r = m.report

  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Mic test</h1>
      <p className="placeholder">
        Diagnostic screen for the capture pipeline (PD-304). Play a note on your piano and watch the
        meter.
      </p>

      <div className="mic-controls">
        <label>
          Input device{' '}
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} disabled={running}>
            <option value="">Default</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Microphone'}
              </option>
            ))}
          </select>
        </label>{' '}
        {running ? (
          <button type="button" onClick={() => m.stop()}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void m.start(deviceId || undefined)}
            disabled={m.state === 'starting'}
          >
            {m.state === 'starting' ? 'Starting…' : 'Start microphone'}
          </button>
        )}
      </div>

      {m.state === 'error' && m.error && (
        <p role="alert" className="mic-error">
          {m.error.message}
        </p>
      )}

      <h2>Level</h2>
      <div className="meter" role="img" aria-label="Microphone level meter">
        <div className="meter-rms" ref={rmsBar} />
        <div className="meter-peak" ref={peakMark} />
      </div>
      <span ref={dbText} aria-live="off" />

      <h2>Clock mapping</h2>
      <pre className="mic-readout" ref={clockText} />
      <p className="placeholder">
        Jitter is how noisy the audio-clock to performance.now() mapping is. Absolute input latency
        is measured separately (PD-311).
      </p>

      {r && (
        <>
          <h2>Capture settings</h2>
          <pre className="mic-readout">
            {[
              `device: ${r.deviceLabel || '(unlabelled)'}`,
              `sample rate: ${r.sampleRate} Hz`,
              `baseLatency: ${(r.baseLatencySec * 1000).toFixed(1)} ms`,
              `outputLatency: ${(r.outputLatencySec * 1000).toFixed(1)} ms`,
              `echoCancellation: ${String(r.echoCancellation)} (want false)`,
              `noiseSuppression: ${String(r.noiseSuppression)} (want false)`,
              `autoGainControl: ${String(r.autoGainControl)} (want false)`,
            ].join('\n')}
          </pre>
        </>
      )}
    </>
  )
}
