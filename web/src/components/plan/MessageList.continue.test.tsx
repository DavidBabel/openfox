// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MessageList } from './MessageList'

const mockContinueWorkflow = vi.fn()

// Store mock state in a way that survives vi.mock hoisting
// Using a module-level object that we mutate (not reassign)
const mockState = {
  phase: 'waiting',
  hasWaitingWorkflow: true,
}

function buildSessionState() {
  return {
    currentSession: {
      id: 's1',
      phase: mockState.phase,
      mode: 'planner',
      criteria: [],
      metadata: {},
      metadataEntries: {},
    },
    waitingWorkflow: mockState.hasWaitingWorkflow
      ? {
          workflowId: 'pr-review',
          workflowName: 'PR Review',
          stepId: 'user_test',
          stepName: 'Manual Testing',
          stepOutput: {} as Record<string, string>,
          params: { feature: 'login' },
        }
      : null,
    activeWorkflowExecution: mockState.hasWaitingWorkflow
      ? {
          id: 'exec-1',
          sessionId: 's1',
          workflowId: 'pr-review',
          workflowName: 'PR Review',
          status: 'waiting' as const,
          currentStepId: 'user_test',
          currentStepName: 'Manual Testing',
          stepOutput: {} as Record<string, string>,
          params: { feature: 'login' },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
      : null,
    messages: [],
    hiddenCount: 0,
    error: null,
    clearError: vi.fn(),
    continueWorkflow: mockContinueWorkflow,
    exitWorkflow: vi.fn(),
  }
}

vi.mock('../../stores/session', () => ({
  useSessionStore: (selector: (state: unknown) => unknown) => selector(buildSessionState()),
  useIsRunning: () => false,
}))

vi.mock('../../stores/workflows', () => ({
  useWorkflowsStore: Object.assign(
    (selector?: (state: unknown) => unknown) =>
      selector
        ? selector({ defaults: [], userItems: [], fetchWorkflows: vi.fn() })
        : { defaults: [], userItems: [], fetchWorkflows: vi.fn() },
    { getState: vi.fn() },
  ),
}))

vi.mock('../../stores/settings', () => ({
  useDisplaySettings: () => ({
    showThinking: true,
    showVerboseToolOutput: true,
    showStats: true,
    showAgentDefinitions: true,
    showWorkflowBars: true,
  }),
}))

vi.mock('./ChatFeedItems', () => ({
  ChatFeedItems: () => <div>ChatFeedItems</div>,
}))

function renderMessageList() {
  return render(
    <MessageList
      displayItems={[]}
      scrollContainerRef={{ current: document.createElement('div') }}
      highlightedMessageId={null}
      onLaunchWorkflow={vi.fn()}
    />,
  )
}

describe('MessageList continue workflow button', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    mockContinueWorkflow.mockClear()
    mockState.phase = 'waiting'
    mockState.hasWaitingWorkflow = true
  })

  it('renders continue button when phase is waiting and waitingWorkflow is set', () => {
    renderMessageList()
    expect(screen.getByRole('button', { name: /continue/i })).toBeDefined()
  })

  it('does not render continue button when waitingWorkflow is null', () => {
    mockState.hasWaitingWorkflow = false
    renderMessageList()
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull()
  })

  it('does not render continue button when phase is not waiting', () => {
    mockState.phase = 'build'
    mockState.hasWaitingWorkflow = false
    renderMessageList()
    expect(screen.queryByRole('button', { name: /continue/i })).toBeNull()
  })

  it('calls continueWorkflow on click', () => {
    renderMessageList()
    screen.getByRole('button', { name: /continue/i }).click()
    expect(mockContinueWorkflow).toHaveBeenCalledTimes(1)
  })
})
