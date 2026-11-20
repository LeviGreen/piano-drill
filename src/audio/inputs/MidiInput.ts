import { midiLog } from './midiLog' // TEMP (IM-404)
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
  /** The browser's own close and open of a port (TEMP, IM-404: used by the reset experiment). */
  close?: () => Promise<unknown>
  open?: () => Promise<unknown>
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
  /** Listen to just this device from the start (an id remembered from last time), or to all with null. */
  deviceId?: string | null
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
  /** TEMP (IM-404): true while resetPorts is closing and reopening, so rescans do not reopen a port too early. */
  private resetting = false
  /** TEMP (IM-404): messages heard per port since we last started listening to it, and the timers that report them. */
  private heard = new Map<string, number>()
  private heardTimers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(opts: MidiInputOptions = {}) {
    this.requestAccess =
      opts.requestAccess === undefined ? browserRequestAccess() : opts.requestAccess
    this.now = opts.now ?? (() => performance.now())
    this.selected = opts.deviceId ?? null
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

  /** TEMP (IM-404): what the browser says about every port right now. */
  private ports() {
    const out: {
      id: string
      name: string | null | undefined
      state: string
      connection?: string
    }[] = []
    this.access?.inputs.forEach((p) =>
      out.push({ id: p.id, name: p.name, state: p.state, connection: p.connection }),
    )
    return out
  }

  start(): Promise<void> {
    midiLog('start()', { status: this._status, selected: this.selected })
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
      midiLog('requestMIDIAccess…')
      this.access = await this.requestAccess!()
      midiLog('access granted; ports at that moment', this.ports())
    } catch (e) {
      midiLog('requestMIDIAccess failed', String(e))
      const name = e instanceof Error ? e.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        this.fail(
          'denied',
          "MIDI access was blocked. Allow it in the browser's site settings, then connect again.",
        )
      }
      this.fail('error', `Could not start MIDI: ${e instanceof Error ? e.message : String(e)}`)
    }
    this.access!.onstatechange = (ev) => {
      const p = (ev as { port?: MidiPortLike & { type?: string } } | undefined)?.port
      midiLog(
        'statechange',
        p && { id: p.id, name: p.name, type: p.type, state: p.state, connection: p.connection },
      )
      this.rescan()
    }
    this.setStatus('ready')
    this.rescan()
  }

  private fail(status: 'unsupported' | 'denied' | 'error', message: string): never {
    this._error = message
    this.setStatus(status)
    throw new MidiUnavailableError(status, message)
  }

  stop(): void {
    midiLog('stop()', { ports: this.ports(), stats: this.stats })
    for (const t of this.heardTimers.values()) clearTimeout(t)
    this.heardTimers.clear()
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
    midiLog('select()', { id })
    this.selected = id
    this.rescan()
  }

  /**
   * TEMP (IM-404, an experiment): really close every input port and open it again, which the app never does otherwise
   * (stop() only removes the message handler and leaves the port open). Does this do what unplugging the USB does?
   */
  async resetPorts(): Promise<void> {
    if (!this.access) return
    const ports: MidiPortLike[] = []
    this.access.inputs.forEach((p) => ports.push(p))
    midiLog('resetPorts: before', this.ports())
    this.resetting = true
    try {
      for (const p of ports) p.onmidimessage = null
      for (const p of ports) {
        try {
          await p.close?.()
        } catch (e) {
          midiLog('resetPorts: close failed', { port: p.id, error: String(e) })
        }
      }
      midiLog('resetPorts: closed', this.ports())
      for (const p of ports) {
        try {
          await p.open?.()
        } catch (e) {
          midiLog('resetPorts: open failed', { port: p.id, error: String(e) })
        }
      }
      midiLog('resetPorts: reopened', this.ports())
    } finally {
      this.resetting = false
      this.rescan()
    }
  }

  /** Re-read the device list, listen to the right ports, and let go of notes on ports that are gone or no longer wanted. */
  private rescan(): void {
    if (!this.access) return
    if (this.resetting) return
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
        // TEMP (IM-404): does anything arrive after we start listening? (Most pianos send a heartbeat every ~300 ms.)
        this.heard.set(port.id, 0)
        clearTimeout(this.heardTimers.get(port.id))
        this.heardTimers.set(
          port.id,
          setTimeout(
            () =>
              midiLog('3 s after listening', {
                port: port.id,
                messages: this.heard.get(port.id),
                connection: port.connection,
              }),
            3000,
          ),
        )
        port.onmidimessage = (e) => this.onMessage(port, e)
      } else {
        port.onmidimessage = null
      }
    })
    midiLog('rescan', { selected: this.selected, listening: [...live], ports: this.ports() })
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
    const before = this.heard.get(portId) ?? 0
    this.heard.set(portId, before + 1)
    if (before === 0)
      midiLog('first message since listening', {
        port: portId,
        bytes: e.data ? Array.from(e.data) : [],
        meaning: describeMidiMessage(e.data),
      })
    this.record(port, e.data)
    const msg = parseMidiMessage(e.data)
    if (!msg) return
    const t = e.timeStamp > 0 ? e.timeStamp : this.now()
    const notes = this.held.get(portId) ?? new Set<number>()
    this.held.set(portId, notes)
    if (msg.type === 'on') {
      notes.add(msg.midi)
      this.emit([{ midi: msg.midi, t }], t)
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
    const active = new Set<number>()
    for (const notes of this.held.values()) for (const m of notes) active.add(m)
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
