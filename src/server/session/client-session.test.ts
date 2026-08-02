import { describe, expect, it } from 'vitest'
import { toClientSession } from './client-session.js'

describe('toClientSession', () => {
  it('empties messages and preserves other fields', () => {
    const session = {
      id: 's1',
      projectId: 'p1',
      workdir: '/tmp/p1',
      mode: 'builder',
      phase: 'build',
      isRunning: true,
      criteria: [],
      metadataEntries: {},
      contextWindows: [],
      executionState: null,
      messageCount: 12,
      messages: [{ id: 'm1' }],
    } as any

    const result = toClientSession(session)

    expect(result.messages).toEqual([])
    expect(result.messageCount).toBe(12)
    expect(result.mode).toBe('builder')
    expect(result.phase).toBe('build')
    expect(result.isRunning).toBe(true)
  })

  it('falls back to messages.length when messageCount is absent', () => {
    const session = {
      id: 's1',
      messages: [{ id: 'm1' }, { id: 'm2' }],
    } as any

    const result = toClientSession(session)

    expect(result.messages).toEqual([])
    expect(result.messageCount).toBe(2)
  })

  it('does not mutate the original session object', () => {
    const session = {
      id: 's1',
      messageCount: 3,
      messages: [{ id: 'm1' }],
    } as any

    toClientSession(session)

    expect(session.messages).toHaveLength(1)
    expect(session.messageCount).toBe(3)
  })
})
