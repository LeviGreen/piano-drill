import { describe, expect, it, vi } from 'vitest'
import { newSessionId } from './RepSession'

describe('session ids', () => {
  it('are different every time, even in the same millisecond and with a fixed random number', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    const ids = new Set(Array.from({ length: 1000 }, () => newSessionId()))
    expect(ids.size).toBe(1000)
    vi.restoreAllMocks()
  })
})
