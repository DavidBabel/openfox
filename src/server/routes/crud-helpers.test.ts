import { describe, expect, it } from 'vitest'
import { resolveProjectDir } from './crud-helpers.js'

function req(query: Record<string, unknown>): { query: Record<string, unknown> } {
  return { query }
}

describe('resolveProjectDir', () => {
  it('falls back to the configured project dir when no workdir query is present', () => {
    expect(resolveProjectDir(req({}), '/configured/project')).toBe('/configured/project')
  })

  it('falls back when workdir query is empty or whitespace', () => {
    expect(resolveProjectDir(req({ workdir: '' }), '/configured/project')).toBe('/configured/project')
    expect(resolveProjectDir(req({ workdir: '   ' }), '/configured/project')).toBe('/configured/project')
  })

  it('falls back when workdir query is not a string', () => {
    expect(resolveProjectDir(req({ workdir: ['/a', '/b'] }), '/configured/project')).toBe('/configured/project')
    expect(resolveProjectDir(req({ workdir: 42 }), '/configured/project')).toBe('/configured/project')
  })

  it('returns the workdir query trimmed of surrounding whitespace', () => {
    expect(resolveProjectDir(req({ workdir: '  /session/project  ' }), '/configured/project')).toBe('/session/project')
  })

  it('returns undefined when no query and no fallback', () => {
    expect(resolveProjectDir(req({}))).toBeUndefined()
  })
})
