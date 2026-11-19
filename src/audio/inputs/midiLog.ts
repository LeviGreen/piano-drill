/*
 * TEMPORARY (IM-404, the MIDI connection spike). Remove this file, and every `midiLog` call, when the spike is done.
 *
 * Writes a line to the browser console and keeps every line in `window.__midiLog`, so after trying to connect you can run
 *   copy(__midiLog.join('\n'))
 * in the console and paste the result.
 */
const lines: string[] = []

export function midiLog(message: string, data?: unknown): void {
  if (import.meta.env.MODE === 'test') return
  const line = `${Math.round(performance.now())} ms  ${message}${data === undefined ? '' : '  ' + JSON.stringify(data)}`
  lines.push(line)
  ;(globalThis as unknown as { __midiLog?: string[] }).__midiLog = lines
  console.log('[midi]', line)
}
