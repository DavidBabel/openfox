import { describe, expect, it } from 'vitest'
import { MIN_CONTEXT_WARNING, isSmallContext } from './context-warning'

describe('isSmallContext', () => {
  it('flags contexts below the warning threshold', () => {
    expect(isSmallContext(MIN_CONTEXT_WARNING - 1)).toBe(true)
    expect(isSmallContext(8192)).toBe(true)
    expect(isSmallContext(0)).toBe(true)
  })

  it('accepts contexts at or above the warning threshold', () => {
    expect(isSmallContext(MIN_CONTEXT_WARNING)).toBe(false)
    expect(isSmallContext(32768)).toBe(false)
    expect(isSmallContext(262144)).toBe(false)
  })
})
