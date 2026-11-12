import type { NoteInput, NoteInputListener, NoteInputState, Onset } from './NoteInput'

/*
 * A digital piano connected to the computer, read with the Web MIDI API (PD-313). It is exact: a key going down is a
 * note-on message with the note number, so nothing has to be listened for or guessed. Each message carries a timestamp
 * on the same clock as `performance.now()`, which is the clock the drill timer uses.
 */

/** The pieces of the Web MIDI API this class needs, so a fake can stand in for it in tests. */
export interface MidiPortLike {
  id: string
  name?: string | null
  state: string
  /** 'open', 'closed' or 'pending': whether the browser has the port open (a port another program holds stays closed). */
  connection?: string
  onmidimessage: ((event: { data: Uint8Array | null; timeStamp: number }) => void) | null
}
export interface MidiAccessLike {
  inputs: { forEach(callback: (port: MidiPortLike) => void): void }
  onstatechange: ((event: unknown) => void) | null
}
export type RequestMidiAccess = () => Promise<MidiAccessLike>

/** What the app can show for a connected MIDI input. */
export type MidiDevice = {
  id: string
  name: string
  connected: boolean
  /** Whether the browser has the port open, when it says. */
  connection: string | null
}

/** The last message heard, for the diagnostics on the test screen: what it was and where it came from. */
export type MidiDiagnostics = {
  /** Every message that has arrived, and how many of them were only background chatter (clock, heartbeat). */
  messages: number
  background: number
  last: { port: string; bytes: number[]; meaning: string } | null
}

export type MidiStatus =
  | 'idle' // not started
  | 'connecting' // asking the browser (it may be showing a permission prompt)
  | 'ready' // listening
  | 'unsupported' // this browser has no Web MIDI (Safari, iPhone, iPad; Firefox needs an add-on)
  | 'denied' // the user (or the browser) said no
  | 'error' // something else went wrong

/** Why the MIDI input could not start. `status` says which of the clear states to show. */
export class MidiUnavailableError extends Error {
  readonly status: 'unsupported' | 'denied' | 'error'
  constructor(status: 'unsupported' | 'denied' | 'error', message: string) {
    super(message)
    this.name = 'MidiUnavailableError'
    this.status = status
  }
}

export type ParsedMidi =
  | { type: 'on'; midi: number; velocity: number }
  | { type: 'off'; midi: number }
  | { type: 'allOff' } // "all sound off" and "all notes off" (the panic messages)
  | null

/**
 * What a raw MIDI message means to us. Any channel. A note-on with velocity 0 is a note-off. The sustain pedal and every
 * other controller is ignored (a key released while the pedal is down is still released), except the two "all notes
 * off" messages, so a stuck note can be cleared.
 */
export function parseMidiMessage(data: ArrayLike<number> | null): ParsedMidi {
  if (!data || data.length < 2) return null
  const type = data[0] & 0xf0
  if (type === 0x90 && data.length >= 3) {
    return data[2] > 0
      ? { type: 'on', midi: data[1], velocity: data[2] }
      : { type: 'off', midi: data[1] }
  }
  if (type === 0x80) return { type: 'off', midi: data[1] }
  if (type === 0xb0 && (data[1] === 120 || data[1] === 123)) return { type: 'allOff' }
  return null
}

/** A short description of a raw message, in words. */
export function describeMidiMessage(data: ArrayLike<number> | null): string {
  if (!data || data.length === 0) return 'empty'
  const status = data[0]
  if (status === 0xfe) return 'heartbeat (active sensing)'
  if (status === 0xf8) return 'clock'
  if (status >= 0xf0) return 'system message'
  const msg = parseMidiMessage(data)
  if (msg?.type === 'on') return `note on ${msg.midi}, velocity ${msg.velocity}`
  if (msg?.type === 'off') return `note off ${msg.midi}`
  if (msg?.type === 'allOff') return 'all notes off'
  const type = status & 0xf0
  if (type === 0xb0)
    return data[1] === 64 ? 'sustain pedal (ignored)' : `controller ${data[1]} (ignored)`
  if (type === 0xc0) return 'program change (ignored)'
  if (type === 0xe0) return 'pitch bend (ignored)'
  if (type === 0xd0 || type === 0xa0) return 'pressure (ignored)'
  return 'not a note (ignored)'
}

/** The browser's own MIDI request, or null where there is none. */
function browserRequestAccess(): RequestMidiAccess | null {
  if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function')
    return null
  return () => navigator.requestMIDIAccess({ sysex: false }) as unknown as Promise<MidiAccessLike>
}

export type MidiInputOptions = {
  /** For tests: stands in for `navigator.requestMIDIAccess`. */
  requestAccess?: RequestMidiAccess | null
  /** For tests: the time to use for a message that has no timestamp. */
  now?: () => number
}

/**
 * A `NoteInput` for a MIDI keyboard. `start()` asks the browser for MIDI access (which may show a permission prompt),
 * then listens to every MIDI input, or only the one chosen with `select`. Pianos can be plugged in and out while it
 * runs: the device list follows, and notes held on a piano that disappears are released.
 */
export class MidiInput implements NoteInput {
  private readonly requestAccess: RequestMidiAccess | null
  private readonly now: () => number
  private access: MidiAccessLike | null = null
  private readonly listeners = new Set<NoteInputListener>()
  private readonly changeListeners = new Set<() => void>()
  /** The notes held down on each port, by port id. */
  private readonly held = new Map<string, Set<number>>()
  private selected: string | null = null
  private _status: MidiStatus = 'idle'
  private _error = ''
  private _devices: MidiDevice[] = []
  private starting: Promise<void> | null = null
  private stats = { messages: 0, background: 0, last: null as MidiDiagnostics['last'] }
  private lastChangeAt = 0

  constructor(opts: MidiInputOptions = {}) {
    this.requestAccess =
      opts.requestAccess === undefined ? browserRequestAccess() : opts.requestAccess
    this.now = opts.now ?? (() => performance.now())
  }

  get status(): MidiStatus {
    return this._status
  }
  /** A sentence about what went wrong, when the status is denied, unsupported or error. */
  get error(): string {
    return this._error
  }
  get devices(): MidiDevice[] {
    return [...this._devices]
  }
  /** What has arrived so far, to check that a piano is really sending. */
  get diagnostics(): MidiDiagnostics {
    return { ...this.stats }
  }
  /** The device being listened to, or null for all of them. */
  get selectedDeviceId(): string | null {
    return this.selected
  }

  onUpdate(cb: NoteInputListener): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  /** Told whenever the status or the list of devices changes (for screens). */
  onChange(cb: () => void): () => void {
    this.changeListeners.add(cb)
    return () => this.changeListeners.delete(cb)
  }

  start(): Promise<void> {
    if (this._status === 'ready') return Promise.resolve()
    this.starting ??= this.connect().finally(() => (this.starting = null))
    return this.starting
  }

  private async connect(): Promise<void> {
    if (!this.requestAccess) {
      this.fail(
        'unsupported',
        "This browser can't read MIDI. Use Chrome, Edge or Opera on a computer (Safari, iPhones and iPads don't support it).",
      )
    }
    this.setStatus('connecting')
    try {
      this.access = await this.requestAccess!()
    } catch (e) {
      const name = e instanceof Error ? e.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.fail(
          'denied',
          "MIDI access was blocked. Allow it in the browser's site settings, then connect again.",
        )
      }
      this.fail('error', `Could not start MIDI: ${e instanceof Error ? e.message : String(e)}`)
    }
    this.access!.onstatechange = () => this.rescan()
    this.setStatus('ready')
    this.rescan()
  }

  private fail(status: 'unsupported' | 'denied' | 'error', message: string): never {
    this._error = message
    this.setStatus(status)
    throw new MidiUnavailableError(status, message)
  }

  stop(): void {
    if (this.access) {
      this.access.onstatechange = null
      this.access.inputs.forEach((port) => (port.onmidimessage = null))
    }
    this.access = null
    const hadNotes = [...this.held.values()].some((s) => s.size > 0)
    this.held.clear()
    this._devices = []
    this._error = ''
    this.stats = { messages: 0, background: 0, last: null }
    this.setStatus('idle')
    if (hadNotes) this.emit([])
  }

  /** Listen to one device (by id), or to all of them with null. */
  select(id: string | null): void {
    this.selected = id
    this.rescan()
  }

  /** Re-read the device list, listen to the right ports, and let go of notes on ports that are gone or no longer wanted. */
  private rescan(): void {
    if (!this.access) return
    const devices: MidiDevice[] = []
    const live = new Set<string>()
    this.access.inputs.forEach((port) => {
      const connected = port.state === 'connected'
      devices.push({
        id: port.id,
        name: port.name?.trim() || 'MIDI device',
        connected,
        connection: port.connection ?? null,
      })
      const wanted = connected && (this.selected === null || this.selected === port.id)
      if (wanted) {
        live.add(port.id)
        port.onmidimessage = (e) => this.onMessage(port, e)
      } else {
        port.onmidimessage = null
      }
    })
    // A piano that is gone, or that we stopped listening to, can have no keys held.
    let released = false
    for (const [id, notes] of this.held) {
      if (!live.has(id)) {
        if (notes.size > 0) released = true
        this.held.delete(id)
      }
    }
    this._devices = devices
    this.changed()
    if (released) this.emit([])
  }

  private onMessage(port: MidiPortLike, e: { data: Uint8Array | null; timeStamp: number }): void {
    const portId = port.id
    this.record(port, e.data)
    const msg = parseMidiMessage(e.data)
    if (!msg) return
    const t = e.timeStamp > 0 ? e.timeStamp : this.now()
    const notes = this.held.get(portId) ?? new Set<number>()
    this.held.set(portId, notes)
    if (msg.type === 'on') {
      notes.add(msg.midi)
      this.emit([{ midi: msg.midi, t, confidence: msg.velocity / 127 }], t)
    } else if (msg.type === 'off') {
      if (notes.delete(msg.midi)) this.emit([], t)
    } else {
      const had = notes.size > 0
      notes.clear()
      if (had) this.emit([], t)
    }
  }

  /** Count and remember a message, however little the app does with it. Background chatter updates screens only now and then. */
  private record(port: MidiPortLike, data: Uint8Array | null): void {
    const background = !!data && data.length > 0 && (data[0] === 0xfe || data[0] === 0xf8)
    this.stats.messages++
    if (background) this.stats.background++
    this.stats.last = {
      port: port.name?.trim() || port.id,
      bytes: data ? Array.from(data) : [],
      meaning: describeMidiMessage(data),
    }
    const t = this.now()
    if (!background || t - this.lastChangeAt > 300) {
      this.lastChangeAt = t
      this.changed()
    }
  }

  private emit(onsets: Onset[], t = this.now()): void {
    const active = new Map<number, number>()
    for (const notes of this.held.values()) for (const m of notes) active.set(m, 1)
    const state: NoteInputState = { t, activeNotes: active, onsets }
    for (const cb of [...this.listeners]) cb(state)
  }

  private setStatus(s: MidiStatus): void {
    this._status = s
    this.changed()
  }

  private changed(): void {
    for (const cb of [...this.changeListeners]) cb()
  }
}
