import { describe, expect, it } from 'vitest'
import { classifyMicError, MicError } from './micErrors'

const named = (name: string) => Object.assign(new Error('x'), { name })

describe('classifyMicError', () => {
  it.each([
    ['NotAllowedError', 'denied'],
    ['SecurityError', 'denied'],
    ['NotFoundError', 'no-device'],
    ['OverconstrainedError', 'no-device'],
    ['NotReadableError', 'busy'],
    ['SomethingElse', 'unknown'],
  ])('%s -> %s', (name, kind) => {
    expect(classifyMicError(named(name)).kind).toBe(kind)
  })

  it('passes MicError through and handles non-errors', () => {
    const e = new MicError('worklet', 'm')
    expect(classifyMicError(e)).toBe(e)
    expect(classifyMicError('boom').kind).toBe('unknown')
  })

  it('always gives a human-readable message', () => {
    expect(classifyMicError(named('NotAllowedError')).message).toMatch(/permission/i)
  })
})
