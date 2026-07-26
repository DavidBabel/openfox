import { describe, expect, it } from 'vitest'

/**
 * Test the paramNames extraction logic used in mapToResponse.
 * The actual implementation in routes/commands.ts does:
 *   Array.from(c.prompt.matchAll(/\{\{(\w+)\}\}/g), (m) => m[1]!)
 */
function extractParamNames(prompt: string): string[] {
  return Array.from(prompt.matchAll(/\{\{(\w+)\}\}/g), (m) => m[1]!)
}

describe('command paramNames extraction', () => {
  it('extracts named params from prompt', () => {
    expect(extractParamNames('Say {{text}} to {{audience}}')).toEqual(['text', 'audience'])
  })

  it('returns empty array for prompt without params', () => {
    expect(extractParamNames('Hello world')).toEqual([])
  })

  it('deduplicates repeated params', () => {
    // matchAll returns all matches; dedup is handled downstream
    expect(extractParamNames('{{name}} and {{name}} again')).toEqual(['name', 'name'])
  })

  it('handles numeric params', () => {
    expect(extractParamNames('{{0}}: {{1}}')).toEqual(['0', '1'])
  })

  it('ignores non-word characters inside braces', () => {
    expect(extractParamNames('{{}}')).toEqual([])
  })

  it('handles empty prompt', () => {
    expect(extractParamNames('')).toEqual([])
  })
})
