// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { lastUserPromptAt } from './session-status.js'
import type { Message } from '@shared/types.js'

function msg(overrides: Partial<Message> & { role?: Message['role'] }): Message {
  return {
    id: `m-${Math.random()}`,
    role: 'user',
    content: 'hello',
    timestamp: '2026-01-01T00:00:00',
    ...overrides,
  } as Message
}

describe('lastUserPromptAt', () => {
  it('returns the timestamp of the last real user message', () => {
    const messages = [
      msg({ role: 'assistant', content: 'working...', timestamp: '2026-01-01T10:00:00' }),
      msg({ timestamp: '2026-01-01T10:01:00' }),
      msg({ role: 'assistant', content: 'done', timestamp: '2026-01-01T10:02:00' }),
    ]
    expect(lastUserPromptAt(messages)).toBe('2026-01-01T10:01:00')
  })

  it('ignores system-generated user messages (auto-prompts, corrections, commands)', () => {
    const messages = [
      msg({ timestamp: '2026-01-01T10:00:00' }),
      msg({ isSystemGenerated: true, messageKind: 'auto-prompt', timestamp: '2026-01-01T10:05:00' }),
      msg({ isSystemGenerated: true, messageKind: 'correction', timestamp: '2026-01-01T10:06:00' }),
      msg({ messageKind: 'command', timestamp: '2026-01-01T10:07:00' }),
    ]
    // The only real prompt is the first one — later system-generated messages
    // must not reset the counter.
    expect(lastUserPromptAt(messages)).toBe('2026-01-01T10:00:00')
  })

  it('treats a workflow-started marker as a user-initiated anchor', () => {
    const messages = [
      msg({ timestamp: '2026-01-01T10:00:00' }),
      msg({ isSystemGenerated: true, messageKind: 'workflow-started', timestamp: '2026-01-01T10:30:00' }),
    ]
    // Launching a workflow resets the timer to the launch time.
    expect(lastUserPromptAt(messages)).toBe('2026-01-01T10:30:00')
  })

  it('returns null when there are no user-initiated messages', () => {
    expect(lastUserPromptAt([])).toBeNull()
    expect(
      lastUserPromptAt([
        msg({ role: 'assistant', content: 'hello', timestamp: '2026-01-01T10:00:00' }),
        msg({ role: 'system', content: 'ctx', timestamp: '2026-01-01T10:00:00' }),
      ]),
    ).toBeNull()
  })
})
