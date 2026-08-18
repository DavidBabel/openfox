import { describe, expect, it } from 'vitest'
import { resolveEffortForModel } from './reasoning-effort.js'

describe('resolveEffortForModel', () => {
  it('passes an in-list candidate through unchanged', () => {
    expect(
      resolveEffortForModel({
        reasoningEfforts: ['low', 'medium', 'high'],
        candidate: 'high',
        defaultEffort: 'medium',
      }),
    ).toBe('high')
  })

  it('clamps an out-of-list candidate to the override (escape hatch) when set', () => {
    expect(
      resolveEffortForModel({
        reasoningEfforts: ['low', 'high'],
        candidate: 'max',
        defaultEffort: 'low',
        override: 'deep',
      }),
    ).toBe('deep')
  })

  it('clamps an out-of-list candidate to the advertised default, else the first list value', () => {
    expect(
      resolveEffortForModel({ reasoningEfforts: ['low', 'medium', 'high'], candidate: 'max', defaultEffort: 'high' }),
    ).toBe('high')
    expect(resolveEffortForModel({ reasoningEfforts: ['low', 'medium', 'high'], candidate: 'max' })).toBe('low')
  })

  it('sends the override verbatim when no explicit candidate is set (never clamped)', () => {
    expect(
      resolveEffortForModel({ reasoningEfforts: ['low', 'medium', 'high'], override: 'deep', defaultEffort: 'medium' }),
    ).toBe('deep')
  })

  it('uses the advertised default when no explicit candidate or override is set', () => {
    expect(resolveEffortForModel({ reasoningEfforts: ['low', 'medium', 'high'], defaultEffort: 'high' })).toBe('high')
  })

  it('sends nothing when the only default is not advertised', () => {
    expect(resolveEffortForModel({ reasoningEfforts: ['low', 'high'], defaultEffort: 'turbo' })).toBeUndefined()
  })

  it('never treats an explicit none as an out-of-list candidate (universal off switch)', () => {
    expect(resolveEffortForModel({ reasoningEfforts: ['low', 'high'], candidate: 'none', defaultEffort: 'low' })).toBe(
      'none',
    )
  })

  it('without a list the candidate (or default/override) is used as-is', () => {
    expect(resolveEffortForModel({ candidate: 'max' })).toBe('max')
    expect(resolveEffortForModel({ candidate: 'none' })).toBe('none')
    expect(resolveEffortForModel({ override: 'deep' })).toBe('deep')
    expect(resolveEffortForModel({ defaultEffort: 'medium' })).toBe('medium')
    expect(resolveEffortForModel({})).toBeUndefined()
  })
})
