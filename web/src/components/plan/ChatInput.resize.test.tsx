// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatInput } from './ChatInput'

const { currentSessionMock } = vi.hoisted(() => ({
  currentSessionMock: { id: 's1', workdir: '/tmp', projectId: 'p1', messageCount: 0 },
}))

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(() => Promise.resolve({ ok: true })),
}))

vi.mock('../../stores/session', () => ({
  useSessionStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentSession: currentSessionMock,
      panes: {},
      focusedSessionId: null,
      stopGeneration: vi.fn(),
      cancelQueued: vi.fn(),
      queuedMessages: [],
      restoredInput: null,
      clearRestoredInput: vi.fn(),
    }),
  useIsRunning: () => false,
  useQueuedMessages: () => [],
}))

vi.mock('../../stores/workflows', () => ({
  useWorkflowsStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({ defaults: [], userItems: [], projectItems: [], fetchWorkflows: vi.fn() }),
    { getState: () => ({ defaults: [], userItems: [], projectItems: [], fetchWorkflows: vi.fn() }) },
  ),
  selectAllWorkflows: (state: { defaults: unknown[]; userItems: unknown[]; projectItems: unknown[] }) => [
    ...state.defaults,
    ...state.userItems,
    ...state.projectItems,
  ],
  useAllWorkflows: () => [],
}))

vi.mock('../../stores/commands', () => ({
  useCommandsStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({ defaults: [], userItems: [], projectItems: [], fetchCommands: vi.fn() }),
    { getState: () => ({ defaults: [], userItems: [], projectItems: [], fetchCommands: vi.fn() }) },
  ),
}))

vi.mock('../../hooks/useScrolledSend', () => ({
  useScrolledSend: () => ({ sendMessage: vi.fn(), launchWorkflow: vi.fn() }),
}))

vi.mock('../../stores/settings', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useSettingsStore: (selector: (state: unknown) => unknown) =>
      selector({ settings: { 'features.perSessionMcp': 'false' } }),
  }
})

const SCROLL_HEIGHT_DESC = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'scrollHeight')

let mockScrollHeight = 0

beforeEach(() => {
  mockScrollHeight = 0
  Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      return mockScrollHeight
    },
  })
})

afterEach(() => {
  if (SCROLL_HEIGHT_DESC) {
    Object.defineProperty(HTMLTextAreaElement.prototype, 'scrollHeight', SCROLL_HEIGHT_DESC)
  }
  cleanup()
  vi.clearAllMocks()
})

function renderChatInput(input = '') {
  return render(
    <ChatInput
      input={input}
      setInput={vi.fn()}
      attachments={[]}
      setAttachments={vi.fn()}
      dragOver={false}
      setDragOver={vi.fn()}
      errorMessage={null}
      setErrorMessage={vi.fn()}
      scrollToBottom={vi.fn()}
      sessionId="s1"
      showHistory={false}
      history={[]}
      selectedIndex={0}
      openHistory={vi.fn()}
      closeHistory={vi.fn()}
      navigateUp={vi.fn()}
      navigateDown={vi.fn()}
      selectCurrent={vi.fn()}
      isAutoScrollActive={true}
      setAutoScroll={vi.fn()}
      onOpenMessageSearch={vi.fn()}
      onOpenCommandsModal={vi.fn()}
      onOpenWorkflowsModal={vi.fn()}
      onSelectWorkflow={vi.fn()}
      onSelectWorkflowWithSubGroup={vi.fn()}
      onSendCommand={vi.fn()}
      clearInput={vi.fn()}
    />,
  )
}

describe('ChatInput auto-resize', () => {
  it('keeps an empty textarea compact even when the placeholder wraps tall (narrow layout)', () => {
    // Simulate a narrow page: an empty textarea whose wrapped placeholder reports a
    // large scrollHeight (previously inflated the box up to the 200px cap on first draw).
    mockScrollHeight = 190
    renderChatInput('')

    const textarea = screen.getByTestId<HTMLTextAreaElement>('chat-input-textarea')
    expect(textarea.style.height).toBe('24px')
  })

  it('grows to the content height once there is real input', () => {
    mockScrollHeight = 176
    renderChatInput('line one\nline two\nline three')

    const textarea = screen.getByTestId<HTMLTextAreaElement>('chat-input-textarea')
    expect(textarea.style.height).toBe('176px')
  })

  it('caps the height at 200px for very tall content', () => {
    mockScrollHeight = 460
    renderChatInput('a\n'.repeat(30))

    const textarea = screen.getByTestId<HTMLTextAreaElement>('chat-input-textarea')
    expect(textarea.style.height).toBe('200px')
  })
})
