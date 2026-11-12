import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { MicCapture } from '../audio/capture/MicCapture'
import { encodeWav } from '../audio/wav'
import type { Category, ManifestEntry, Source } from '../bench/corpus'
import { parsePitch } from '../theory/pitch'

const CATEGORIES: Category[] = [
  'single',
  'interval',
  'triad',
  'two-hand',
  'wrong-note',
  'extra-note',
  'silence',
  'room-noise',
  'transient',
]
/** Long enough for a sequence take: a dozen notes with rests of 4 to 5 seconds between them. */
const MAX_SECONDS = 180

type Take = { entry: ManifestEntry; wav: Uint8Array }

function parseNotes(text: string): string[] {
  const names = text.split(/[\s,]+/).filter(Boolean)
  names.forEach((n) =>
    n
      .split('@')[0]
      .split('+')
      .forEach((note) => parsePitch(note)),
  ) // throws on typos like "H4"; "C4@soft" is a note with a remark (see corpus/README.md)
  return names
}

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Records labelled takes for the benchmark corpus (PD-306). */
export function CorpusRecorderScreen() {
  const [m] = useState(() => new MicCapture())
  const [, bump] = useState(0)
  const [category, setCategory] = useState<Category>('single')
  const [source, setSource] = useState<Source>('acoustic')
  const [played, setPlayed] = useState('C4')
  const [expected, setExpected] = useState('')
  const [room, setRoom] = useState('')
  const [device, setDevice] = useState('')
  const [position, setPosition] = useState('')
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [take, setTake] = useState<Take | null>(null)
  const [error, setError] = useState('')
  const chunks = useRef<Float32Array[]>([])
  const counter = useRef(1)

  useEffect(() => {
    const off = m.onStateChange(() => bump((n) => n + 1))
    return () => {
      off()
      m.stop()
    }
  }, [m])

  useEffect(() => {
    if (!recording) return
    const off = m.onSamples((_, samples) => chunks.current.push(samples.slice()))
    const t0 = performance.now()
    const timer = setInterval(() => {
      const s = (performance.now() - t0) / 1000
      setSeconds(s)
      if (s >= MAX_SECONDS) stop()
    }, 100)
    return () => {
      off()
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, m])

  function begin() {
    setError('')
    try {
      parseNotes(played)
      parseNotes(expected || played)
    } catch {
      setError('Notes must look like C4 F#3 Bb5 (letter, optional # or b, octave).')
      return
    }
    chunks.current = []
    setTake(null)
    setSeconds(0)
    setRecording(true)
  }

  function stop() {
    setRecording(false)
    const total = chunks.current.reduce((n, c) => n + c.length, 0)
    const samples = new Float32Array(total)
    let at = 0
    for (const c of chunks.current) {
      samples.set(c, at)
      at += c.length
    }
    const playedNames = parseNotes(played)
    const id = `${category}-${playedNames.join('').replaceAll('@', '-').replaceAll('+', '') || 'none'}-${Date.now().toString(36)}-${counter.current++}`
    setTake({
      wav: encodeWav(samples, m.sampleRate),
      entry: {
        id,
        file: `${id}.wav`,
        source,
        category,
        played: playedNames,
        expected: parseNotes(expected || played),
        ...(room && { room }),
        ...(device && { device }),
        ...(position && { position }),
      },
    })
  }

  function save() {
    if (!take) return
    download(take.entry.file, take.wav as BlobPart, 'audio/wav')
    download(
      `${take.entry.id}.json`,
      JSON.stringify(take.entry, null, 2) + '\n',
      'application/json',
    )
  }

  const running = m.state === 'running'
  return (
    <>
      <p>
        <Link to="/settings">← Settings</Link>
      </p>
      <h1>Corpus recorder</h1>
      <p className="placeholder">
        Records labelled takes for the benchmark (PD-306). After saving, move the two downloaded
        files into corpus/recorded/ (see corpus/README.md). Turn the keyboard sound on and place the
        laptop where it will sit while practising.
      </p>

      <div className="recorder-form">
        <label>
          Category{' '}
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Source{' '}
          <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
            <option value="acoustic">acoustic piano</option>
            <option value="digital-speaker">digital piano, speakers</option>
          </select>
        </label>
        <label>
          Notes you will play (empty for silence/noise){' '}
          <input
            value={played}
            onChange={(e) => setPlayed(e.target.value)}
            placeholder="C4 E4 G4"
          />
        </label>
        <label>
          Notes the app should expect (empty = same as played){' '}
          <input
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="same as played"
          />
        </label>
        <label>
          Room <input value={room} onChange={(e) => setRoom(e.target.value)} />
        </label>
        <label>
          Device <input value={device} onChange={(e) => setDevice(e.target.value)} />
        </label>
        <label>
          Position <input value={position} onChange={(e) => setPosition(e.target.value)} />
        </label>
      </div>

      <p>
        {running ? (
          <button type="button" onClick={() => m.stop()} disabled={recording}>
            Stop microphone
          </button>
        ) : (
          <button type="button" onClick={() => void m.start()}>
            Start microphone
          </button>
        )}{' '}
        {recording ? (
          <button type="button" onClick={stop}>
            Stop recording ({seconds.toFixed(1)} s)
          </button>
        ) : (
          <button type="button" onClick={begin} disabled={!running}>
            Record
          </button>
        )}
      </p>
      {m.state === 'error' && m.error && (
        <p role="alert" className="mic-error">
          {m.error.message}
        </p>
      )}
      {error && (
        <p role="alert" className="mic-error">
          {error}
        </p>
      )}

      {take && (
        <>
          <h2>Take ready</h2>
          <pre className="mic-readout">
            {JSON.stringify(take.entry, null, 2)}
            {`\nlength: ${(take.wav.length / 2 / m.sampleRate).toFixed(1)} s at ${m.sampleRate} Hz`}
          </pre>
          <button type="button" onClick={save}>
            Save take
          </button>
        </>
      )}
    </>
  )
}
