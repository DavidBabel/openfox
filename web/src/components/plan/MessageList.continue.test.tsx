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
  pendingChoices: undefined as Array<{ id: string; label: string; goto: string }> | undefined,
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
          ...(mockState.pendingChoices ? { pendingChoices: mockState.pendingChoices } : {}),
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
        ? selector({ defaults: [], userItems: [], projectItems: [], fetchWorkflows: vi.fn() })
        : { defaults: [], userItems: [], projectItems: [], fetchWorkflows: vi.fn() },
    { getState: vi.fn() },
  ),
  selectAllWorkflows: (state: { defaults: unknown[]; userItems: unknown[]; projectItems: unknown[] }) => [
    ...state.defaults,
    ...state.userItems,
    ...state.projectItems,
  ],
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
  const mockOsRef = {
    current: {
      osInstance: () => null,
      getElement: () => null,
    },
  }
  return render(
    <MessageList
      displayItems={[]}
      scrollContainerRef={mockOsRef}
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
    mockState.pendingChoices = undefined
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

  it('renders one button per pendingChoices when choices are present', () => {
    mockState.pendingChoices = [
      { id: 'apply', label: 'apply', goto: 'apply_fixes' },
      { id: 'skip', label: 'skip', goto: 'start_dev_server' },
      { id: 'continue', label: 'Continue', goto: 'start_dev_server' },
    ]
    renderMessageList()
    expect(screen.getByRole('button', { name: 'apply' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'skip' })).toBeDefined()
    // The synthetic continue choice keeps the rich "Continue <workflow> (<step>)" label
    expect(screen.getByRole('button', { name: /continue pr review \(manual testing\)/i })).toBeDefined()
  })

  it('calls continueWorkflow with the choice id when a choice button is clicked', () => {
    mockState.pendingChoices = [
      { id: 'apply', label: 'apply', goto: 'apply_fixes' },
      { id: 'skip', label: 'skip', goto: 'start_dev_server' },
    ]
    renderMessageList()
    screen.getByRole('button', { name: 'apply' }).click()
    expect(mockContinueWorkflow).toHaveBeenCalledTimes(1)
    expect(mockContinueWorkflow).toHaveBeenCalledWith('apply')
  })

  it('falls back to a single continue button when pendingChoices is absent', () => {
    mockState.pendingChoices = undefined
    renderMessageList()
    expect(screen.getAllByRole('button', { name: /continue/i })).toHaveLength(1)
  })
})
