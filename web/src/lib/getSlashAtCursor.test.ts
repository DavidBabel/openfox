import { describe, expect, it } from 'vitest'
import { getSlashAtCursor } from './getSlashAtCursor'

describe('getSlashAtCursor', () => {
  it('detects slash at start of input', () => {
    const result = getSlashAtCursor('/rev', 4)
    expect(result).toEqual({ query: 'rev', startIndex: 0 })
  })

  it('returns null when no slash', () => {
    expect(getSlashAtCursor('hello world', 5)).toBeNull()
  })

  it('returns null when slash has space after it (already submitted)', () => {
    expect(getSlashAtCursor('/review ', 8)).toBeNull()
  })

  it('returns null when slash is mid-text', () => {
    expect(getSlashAtCursor('prefix /rev', 12)).toBeNull()
  })

  it('returns null for cursor before slash', () => {
    expect(getSlashAtCursor('/review', 0)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(getSlashAtCursor('', 0)).toBeNull()
  })
})
