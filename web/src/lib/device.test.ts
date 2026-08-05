import { describe, expect, it, vi, afterEach } from 'vitest'
import { shouldAutofocus } from './device'

const mockMatchMedia = (matches: boolean) =>
  vi.fn().mockImplementation(() => ({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shouldAutofocus', () => {
  it('returns false on coarse-pointer touch devices', () => {
    vi.stubGlobal('window', { matchMedia: mockMatchMedia(true) } as any)
    expect(shouldAutofocus()).toBe(false)
  })

  it('returns true on fine-pointer (desktop) devices', () => {
    vi.stubGlobal('window', { matchMedia: mockMatchMedia(false) } as any)
    expect(shouldAutofocus()).toBe(true)
  })

  it('falls back to true when matchMedia is unavailable', () => {
    vi.stubGlobal('window', {} as any)
    expect(shouldAutofocus()).toBe(true)
  })
})
