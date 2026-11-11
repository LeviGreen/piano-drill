export type MicErrorKind =
  | 'unsupported' // no getUserMedia / AudioWorklet
  | 'insecure' // page not served over HTTPS (or localhost)
  | 'denied' // user or policy refused permission
  | 'no-device' // no matching input device
  | 'busy' // device in use / could not be started
  | 'worklet' // capture worklet failed to load
  | 'unknown'

export class MicError extends Error {
  readonly kind: MicErrorKind

  constructor(kind: MicErrorKind, message: string) {
    super(message)
    this.name = 'MicError'
    this.kind = kind
  }
}

const MESSAGES: Record<MicErrorKind, string> = {
  unsupported: 'This browser does not support microphone capture with AudioWorklet.',
  insecure: 'Microphone access needs a secure page (HTTPS or localhost).',
  denied:
    'Microphone permission was denied. Allow it in the browser’s site settings and try again.',
  'no-device': 'No microphone was found, or the selected one is unavailable.',
  busy: 'The microphone could not be started. Another app may be using it.',
  worklet: 'The audio capture module failed to load.',
  unknown: 'Something went wrong starting the microphone.',
}

/** Turn whatever getUserMedia / AudioContext threw into a MicError a UI can explain. */
export function classifyMicError(e: unknown): MicError {
  if (e instanceof MicError) return e
  const name = e instanceof Error || e instanceof DOMException ? e.name : ''
  let kind: MicErrorKind = 'unknown'
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
    kind = 'denied'
  else if (
    name === 'NotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'DevicesNotFoundError'
  )
    kind = 'no-device'
  else if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError')
    kind = 'busy'
  return new MicError(kind, MESSAGES[kind])
}

export function micErrorMessage(kind: MicErrorKind): string {
  return MESSAGES[kind]
}
