// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { parseSlashCommand } from '../../lib/parse-slash-command'
import { ChatInput } from './ChatInput'
import type { WorkflowInfo } from '../../lib/parse-slash-command'

// ============================================================================
// Unit tests: parseSlashCommand
// ============================================================================

describe('parseSlashCommand', () => {
  const workflows: WorkflowInfo[] = [
    {
      id: 'pr-review',
      name: 'PR Review',
      parameters: [
        { id: 'pr_number', label: 'PR Number', position: 0, required: true },
        { id: 'pr_title', label: 'PR Title', position: 1, required: false },
      ],
    },
    { id: 'simple', name: 'Simple' },
  ]

  it('parses /pr-review 157 into workflow and params', () => {
    const result = parseSlashCommand('/pr-review 157', workflows)
    expect(result).toEqual({ workflowId: 'pr-review', params: { pr_number: '157' } })
  })

  it('maps positional args by parameter position', () => {
    const result = parseSlashCommand('/pr-review 42 fix-bug', workflows)
    expect(result).toEqual({ workflowId: 'pr-review', params: { pr_number: '42', pr_title: 'fix-bug' } })
  })

  it('returns null for non-slash input', () => {
    expect(parseSlashCommand('hello world', workflows)).toBeNull()
  })

  it('returns null when workflow not found', () => {
    expect(parseSlashCommand('/nonexistent arg', workflows)).toBeNull()
  })

  it('returns null for just slash', () => {
    expect(parseSlashCommand('/', workflows)).toBeNull()
  })

  it('handles workflow without parameter definitions', () => {
    const result = parseSlashCommand('/simple foo bar', workflows)
    expect(result).toEqual({ workflowId: 'simple', params: { '0': 'foo', '1': 'bar' } })
  })

  it('handles extra args beyond defined parameters', () => {
    const result = parseSlashCommand('/pr-review 42', workflows)
    expect(result).toEqual({ workflowId: 'pr-review', params: { pr_number: '42' } })
  })
})

// ============================================================================
// Integration tests: ChatInput slash command handling
// ============================================================================

const mockSendMessage = vi.fn()
const mockLaunchWorkflow = vi.fn()

const mockWorkflowState = {
  defaults: [
    {
      id: 'pr-review',
      name: 'PR Review',
      parameters: [
        { id: 'pr_number', label: 'PR Number', position: 0, required: true },
        { id: 'pr_title', label: 'PR Title', position: 1, required: false },
      ],
    },
    { id: 'simple', name: 'Simple' },
  ],
  userItems: [],
  projectItems: [],
  fetchWorkflows: vi.fn(),
}

vi.mock('../../stores/session', () => ({
  useSessionStore: (selector: (state: unknown) => unknown) =>
    selector({
      currentSession: { id: 's1', workdir: '/tmp', messages: [], projectId: 'p1' },
      stopGeneration: vi.fn(),
      cancelQueued: vi.fn(),
      queuedMessages: [],
      restoredInput: null,
      clearRestoredInput: vi.fn(),
    }),
  useIsRunning: () => false,
}))

vi.mock('../../stores/workflows', () => ({
  useWorkflowsStore: Object.assign(
    (selector?: (state: unknown) => unknown) => (selector ? selector(mockWorkflowState) : mockWorkflowState),
    { getState: () => mockWorkflowState },
  ),
}))

vi.mock('../../hooks/useScrolledSend', () => ({
  useScrolledSend: () => ({ sendMessage: mockSendMessage, launchWorkflow: mockLaunchWorkflow }),
}))

vi.mock('../../stores/settings', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useSettingsStore: (selector: (state: unknown) => unknown) =>
      selector({ settings: { 'features.perSessionMcp': 'false' } }),
  }
})

function renderChatInput(overrides: Record<string, unknown> = {}) {
  const defaultProps = {
    input: '',
    setInput: vi.fn(),
    attachments: [],
    setAttachments: vi.fn(),
    dragOver: false,
    setDragOver: vi.fn(),
    errorMessage: null,
    setErrorMessage: vi.fn(),
    scrollContainerRef: { current: document.createElement('div') },
    sessionId: 's1',
    sessionMode: 'planner',
    showHistory: false,
    history: [],
    selectedIndex: 0,
    openHistory: vi.fn(),
    closeHistory: vi.fn(),
    navigateUp: vi.fn(),
    navigateDown: vi.fn(),
    selectCurrent: vi.fn(),
    isAutoScrollActive: true,
    setAutoScroll: vi.fn(),
    onOpenMessageSearch: vi.fn(),
    onOpenCommandsModal: vi.fn(),
    onOpenWorkflowsModal: vi.fn(),
    onSelectWorkflow: vi.fn(),
    onSelectWorkflowWithSubGroup: vi.fn(),
    clearInput: vi.fn(),
    ...overrides,
  }
  return render(<ChatInput {...defaultProps} />)
}

describe('ChatInput slash command integration', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('sends plain text via sendMessage', () => {
    const setInput = vi.fn()
    renderChatInput({ input: 'hello world', setInput })

    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.click(sendButton)

    expect(mockSendMessage).toHaveBeenCalledWith('hello world', [])
    expect(mockLaunchWorkflow).not.toHaveBeenCalled()
  })

  it('launches workflow for known slash command with params', () => {
    const setInput = vi.fn()
    renderChatInput({ input: '/pr-review 42 fix-bug', setInput })

    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.click(sendButton)

    expect(mockLaunchWorkflow).toHaveBeenCalledWith(undefined, undefined, 'pr-review', undefined, {
      pr_number: '42',
      pr_title: 'fix-bug',
    })
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('clears input silently for unrecognized slash command', () => {
    const setInput = vi.fn()
    const clearInput = vi.fn()
    renderChatInput({ input: '/nonexistent arg', setInput, clearInput })

    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.click(sendButton)

    expect(mockSendMessage).not.toHaveBeenCalled()
    expect(mockLaunchWorkflow).not.toHaveBeenCalled()
    expect(clearInput).toHaveBeenCalled()
  })

  it('shows error for missing required params', () => {
    const setInput = vi.fn()
    const setErrorMessage = vi.fn()
    renderChatInput({ input: '/pr-review', setInput, setErrorMessage })

    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.click(sendButton)

    expect(setErrorMessage).toHaveBeenCalledWith(expect.stringContaining('PR Number'))
    expect(mockLaunchWorkflow).not.toHaveBeenCalled()
    expect(mockSendMessage).not.toHaveBeenCalled()
  })

  it('launches workflow via Enter key', () => {
    const setInput = vi.fn()
    renderChatInput({ input: '/simple foo', setInput })

    const textarea = screen.getByTestId('chat-input-textarea')
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })

    expect(mockLaunchWorkflow).toHaveBeenCalledWith(undefined, undefined, 'simple', undefined, {
      '0': 'foo',
    })
    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})
