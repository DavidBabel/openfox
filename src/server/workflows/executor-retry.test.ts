/**
 * Workflow Executor – LLM Failure Retry Tests
 *
 * When a workflow agent step's LLM call fails (soft stream error or a thrown
 * LLM error), the executor must retry the step cleanly: the failed attempt is
 * rolled back from history (no leftover bubbles/reminders), the prompt is
 * re-injected once, and no step_done nudge or duplicate reminders accumulate.
 * Retries are capped — after the cap the step is blocked with a clear reason.
 *
 * The existing "agent finished but forgot step_done()" nudge path is preserved:
 * a legitimate completion is NOT rolled back.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkflowDefinition } from './types.js'
import type { OrchestratorOptions } from '../runner/types.js'
import { LLMError } from '../utils/errors.js'

// ============================================================================
// Hoisted shared spies — available in both vi.mock factories and test bodies
// ============================================================================

const { mockAppend } = vi.hoisted(() => ({ mockAppend: vi.fn() }))
const { mockRunAgentTurn } = vi.hoisted(() => ({ mockRunAgentTurn: vi.fn() }))
const { mockGetLatestSeq } = vi.hoisted(() => ({ mockGetLatestSeq: vi.fn() }))
const { mockGetEvents } = vi.hoisted(() => ({ mockGetEvents: vi.fn() }))
const { mockTombstoneEvents } = vi.hoisted(() => ({ mockTombstoneEvents: vi.fn() }))

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('../events/index.js', () => ({
  getEventStore: () => ({
    append: mockAppend,
    getLatestSeq: mockGetLatestSeq,
    getEvents: mockGetEvents,
    tombstoneEvents: mockTombstoneEvents,
  }),
  getCurrentContextWindowId: vi.fn(() => undefined),
}))

vi.mock('../chat/orchestrator.js', () => ({
  runAgentTurn: mockRunAgentTurn,
  createMessageStartEvent: vi.fn(
    (messageId: string, role: string, content: string | undefined, options?: Record<string, unknown>) => ({
      type: 'message.start',
      data: { messageId, role, content, ...options },
    }),
  ),
  TurnMetrics: class TurnMetrics {
    start = vi.fn()
    end = vi.fn()
    addLLMCall = vi.fn()
    addToolTime = vi.fn()
    buildStats = vi.fn(() => ({ durationMs: 0, tokenCount: 0, generationTokens: 0, completionTokens: 0 }))
  },
}))

vi.mock('../sub-agents/manager.js', () => ({
  executeSubAgent: vi.fn(async () => ({ content: '', result: 'success' })),
}))

vi.mock('../agents/registry.js', () => ({
  loadAllAgentsDefault: vi.fn(async () => []),
  findAgentById: vi.fn(() => undefined),
  resolveDefaultAgentId: vi.fn(() => 'planner'),
}))

vi.mock('../tools/index.js', () => ({
  getToolRegistryForAgent: vi.fn(() => ({ tools: [], definitions: [], execute: vi.fn() })),
}))

vi.mock('./shell.js', () => ({
  executeShellCommand: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 })),
}))

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../../shared/stats.js', () => ({
  computeSessionStats: vi.fn(() => ({ generationTokens: 0, avgGenerationSpeed: 0, responseCount: 0, llmCallCount: 0 })),
}))

vi.mock('../git/diff.js', () => ({
  formatGitDiffFiles: vi.fn(async () => '(none)'),
}))

import { executeWorkflow, evaluateLLMRetry } from './executor.js'

// ============================================================================
// Helpers
// ============================================================================

function createWorkflow(overrides?: Partial<WorkflowDefinition>): WorkflowDefinition {
  return {
    metadata: { id: 'test', name: 'Test', description: '', version: '1' },
    entryStep: 'build',
    settings: { maxIterations: 10 },
    steps: [
      {
        id: 'build',
        name: 'Builder',
        type: 'agent',
        phase: 'build',
        agentId: 'builder',
        prompt: 'Implement the feature according to the plan.',
        nudgePrompt: "Keep going, you're almost there.",
        transitions: [{ when: { type: 'always' }, goto: '$done' }],
      },
    ],
    ...overrides,
  }
}

function createMockOptions(extra?: Partial<OrchestratorOptions>): OrchestratorOptions {
  return {
    scope: 'auto',
    sessionManager: {
      requireSession: vi.fn(() => ({
        workdir: '/tmp/test',
        messages: [],
        metadataEntries: {},
      })),
      setMode: vi.fn(),
      setPhase: vi.fn(),
      getEffectiveWorkdir: vi.fn().mockReturnValue('/tmp/test'),
      getProjectWorkdir: vi.fn().mockReturnValue('/tmp/test'),
      addMessage: vi.fn(),
      startWorkflow: vi.fn(),
      updateWorkflowStep: vi.fn(),
      completeWorkflow: vi.fn(),
      blockWorkflow: vi.fn(),
      waitAtStep: vi.fn(),
      resumeWorkflow: vi.fn(),
      getActiveWorkflowExecution: vi.fn(() => null),
      cancelWorkflow: vi.fn(),
    } as any,
    sessionId: 'test-session',
    llmClient: { getModel: () => 'test-model' } as any,
    // Zero-delay backoff so retries are instant in tests; a generous window.
    llmRetryPolicy: { backoffMs: [0, 0, 0, 0], minIntervalMs: 0, maxDurationMs: 60_000, maxAttempts: 40 },
    ...extra,
  }
}

function nudgeEvents(): any[] {
  return mockAppend.mock.calls.filter(
    (call: any[]) =>
      call[1]?.type === 'message.start' &&
      call[1]?.data?.isSystemGenerated &&
      typeof call[1]?.data?.content === 'string' &&
      (call[1]?.data?.content as string).includes("You haven't called step_done()"),
  )
}

function promptEvents(): any[] {
  return mockAppend.mock.calls.filter(
    (call: any[]) =>
      call[1]?.type === 'message.start' &&
      call[1]?.data?.isSystemGenerated &&
      typeof call[1]?.data?.content === 'string' &&
      (call[1]?.data?.content as string).includes('Implement the feature'),
  )
}

function wireStepDone(call: { onToolExecuted?: (tc: any, tr: any) => void } | undefined): void {
  call?.onToolExecuted?.({ name: 'step_done', arguments: {} }, { success: true, output: '' })
}

// ============================================================================
// Tests
// ============================================================================

describe('workflow agent step LLM failure retry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEvents.mockReturnValue([])
  })

  it('rolls back a soft-failed attempt and retries cleanly (no nudge, prompt re-injected once)', async () => {
    let seq = 10
    mockGetLatestSeq.mockImplementation(() => ++seq)
    // Events appended during the failed attempt (message ids + error)
    mockGetEvents.mockReturnValue([
      { type: 'message.start', data: { messageId: 'assistant-fail-1', role: 'assistant' } },
      { type: 'chat.error', data: { error: 'boom' } },
    ])

    let callCount = 0
    mockRunAgentTurn.mockImplementation(
      async (
        _opts: any,
        _metrics: any,
        _agentId: string,
        _append: any,
        extra: { onToolExecuted?: (tc: any, tr: any) => void } | undefined,
      ) => {
        callCount++
        if (callCount === 1) {
          // First attempt: LLM reports a stream error → failed
          return { failed: { error: 'LLM boom' } }
        }
        wireStepDone(extra)
        return { returnValueResult: 'completed' }
      },
    )

    const workflow = createWorkflow()
    const onMessage = vi.fn()
    const options = createMockOptions({ onMessage })

    const result = await executeWorkflow(workflow, options)

    expect(result.finalAction.type).toBe('DONE')
    // Retried exactly once after the failure
    expect(mockRunAgentTurn).toHaveBeenCalledTimes(2)
    // The failed attempt was rolled back (tombstoned)
    expect(mockTombstoneEvents).toHaveBeenCalledTimes(1)
    // Failed message ids relayed for removal via the event store (FIFO with the removed events)
    const removedEvents = mockAppend.mock.calls
      .map((c: any[]) => c[1])
      .filter((e: any) => e?.type === 'message.removed')
    expect(removedEvents).toHaveLength(1)
    expect((removedEvents[0] as any).data.messageIds).toContain('assistant-fail-1')
    // Retry status relayed (attempt 2 of 3)
    const retryEvents = mockAppend.mock.calls
      .map((c: any[]) => c[1])
      .filter((e: any) => e?.type === 'workflow.step_retry')
    expect(retryEvents).toHaveLength(1)
    expect((retryEvents[0] as any).data.attempt).toBe(2)
    expect((retryEvents[0] as any).data.retryInMs).toBe(0)
    // The step prompt is injected exactly once — never repeated on retry
    expect(promptEvents().length).toBe(1)
    // ...and never a nudge for an LLM-failed attempt
    expect(nudgeEvents().length).toBe(0)
  })

  it('catches thrown LLM errors, rolls back, and retries', async () => {
    let seq = 20
    mockGetLatestSeq.mockImplementation(() => ++seq)
    mockGetEvents.mockReturnValue([
      { type: 'message.start', data: { messageId: 'assistant-throw-1', role: 'assistant' } },
    ])

    let callCount = 0
    mockRunAgentTurn.mockImplementation(
      async (
        _opts: any,
        _metrics: any,
        _agentId: string,
        _append: any,
        extra: { onToolExecuted?: (tc: any, tr: any) => void } | undefined,
      ) => {
        callCount++
        if (callCount === 1) {
          throw new LLMError('LLM stream idle timeout')
        }
        wireStepDone(extra)
        return { returnValueResult: 'completed' }
      },
    )

    const workflow = createWorkflow()
    const onMessage = vi.fn()
    const result = await executeWorkflow(workflow, createMockOptions({ onMessage }))

    expect(result.finalAction.type).toBe('DONE')
    expect(mockRunAgentTurn).toHaveBeenCalledTimes(2)
    expect(mockTombstoneEvents).toHaveBeenCalledTimes(1)
    const removedEvents = mockAppend.mock.calls
      .map((c: any[]) => c[1])
      .filter((e: any) => e?.type === 'message.removed')
    expect(removedEvents).toHaveLength(1)
  })

  it('blocks after max consecutive LLM failures and surfaces a descriptive error', async () => {
    let seq = 30
    mockGetLatestSeq.mockImplementation(() => ++seq)
    mockGetEvents.mockReturnValue([
      { type: 'message.start', data: { messageId: 'assistant-fail-x', role: 'assistant' } },
    ])

    mockRunAgentTurn.mockImplementation(async () => ({ failed: { error: 'Rate limited' } }))

    const workflow = createWorkflow()
    const onMessage = vi.fn()
    // Force a hard cap of 3 consecutive failures before giving up
    const options = createMockOptions({
      onMessage,
      llmRetryPolicy: { backoffMs: [0, 0, 0, 0], minIntervalMs: 0, maxDurationMs: 60_000, maxAttempts: 3 },
    })
    const result = await executeWorkflow(workflow, options)

    // 3 attempts total (cap), then give up
    expect(mockRunAgentTurn).toHaveBeenCalledTimes(3)
    // Every failed attempt is rolled back — including the final one (no leftover bubble)
    expect(mockTombstoneEvents).toHaveBeenCalledTimes(3)
    expect(result.finalAction.type).toBe('BLOCKED')
    expect((result.finalAction as { reason: string }).reason).toContain('failed after 3 attempts')
    expect((result.finalAction as { reason: string }).reason).toContain('Rate limited')
    // Descriptive chat.error relayed on exhaustion
    const errEvents = mockAppend.mock.calls.map((c: any[]) => c[1]).filter((e: any) => e?.type === 'chat.error')
    expect(errEvents).toHaveLength(1)
    expect((errEvents[0] as any).data.error).toContain('3 attempts')
    // No noisy "Step failed" system card in the feed
    const stepFailedCards = mockAppend.mock.calls
      .map((c: any[]) => c[1])
      .filter(
        (e: any) =>
          e?.type === 'message.start' &&
          typeof e?.data?.content === 'string' &&
          (e.data.content as string).includes('Step failed'),
      )
    expect(stepFailedCards).toHaveLength(0)
    // Execution marked blocked
    expect((options.sessionManager as any).blockWorkflow).toHaveBeenCalled()
  })

  it('does not roll back when the agent simply forgets step_done()', async () => {
    let seq = 40
    mockGetLatestSeq.mockImplementation(() => ++seq)

    mockRunAgentTurn.mockImplementation(async () => ({ returnValueResult: 'completed' }))

    const workflow = createWorkflow()
    const result = await executeWorkflow(workflow, createMockOptions())

    // Agent completed its turn but never called step_done → nudge loop, no rollback
    expect(result.finalAction.type).toBe('BLOCKED') // maxIterations exhausted without step_done
    expect(mockTombstoneEvents).not.toHaveBeenCalled()
    expect(nudgeEvents().length).toBeGreaterThan(0)
  })

  it('propagates non-LLM errors instead of retrying them', async () => {
    let seq = 50
    mockGetLatestSeq.mockImplementation(() => ++seq)

    mockRunAgentTurn.mockImplementation(async () => {
      throw new Error('internal bug')
    })

    const workflow = createWorkflow()
    await expect(executeWorkflow(workflow, createMockOptions())).rejects.toThrow('internal bug')
    expect(mockTombstoneEvents).not.toHaveBeenCalled()
    expect(mockRunAgentTurn).toHaveBeenCalledTimes(1)
  })

  it('protects user-authored messages when rolling back a failed attempt', async () => {
    let seq = 60
    mockGetLatestSeq.mockImplementation(() => ++seq)
    // A user message drained into the stream mid-attempt plus the failed turn
    mockGetEvents.mockReturnValue([
      { seq: 91, type: 'message.start', data: { messageId: 'user-queued', role: 'user', content: 'focus on tests' } },
      { seq: 92, type: 'message.done', data: { messageId: 'user-queued' } },
      { seq: 93, type: 'message.start', data: { messageId: 'assistant-fail-2', role: 'assistant' } },
      { seq: 94, type: 'chat.error', data: { error: 'boom' } },
    ])

    mockRunAgentTurn.mockImplementation(async () => ({ failed: { error: 'boom' } }))

    const workflow = createWorkflow()
    await executeWorkflow(workflow, createMockOptions())

    // Only the failed attempt's events are tombstoned — the user message survives
    const [, seqs] = mockTombstoneEvents.mock.calls[0] as [string, number[]]
    expect(seqs.sort((a, b) => a - b)).toEqual([93, 94])
    // And the removal relays never target the user message
    const removedEvents = mockAppend.mock.calls
      .map((c: any[]) => c[1])
      .filter((e: any) => e?.type === 'message.removed')
    expect(removedEvents.length).toBeGreaterThan(0)
    for (const ev of removedEvents) {
      const removedIds = (ev as any).data.messageIds as string[]
      expect(removedIds).not.toContain('user-queued')
      expect(removedIds).toContain('assistant-fail-2')
    }
  })

  it('keeps the execution tracked when retrying a blocked step via resume', async () => {
    let seq = 70
    mockGetLatestSeq.mockImplementation(() => ++seq)
    mockGetEvents.mockReturnValue([{ type: 'message.start', data: { messageId: 'assistant-r', role: 'assistant' } }])

    let callCount = 0
    mockRunAgentTurn.mockImplementation(
      async (
        _opts: any,
        _metrics: any,
        _agentId: string,
        _append: any,
        extra: { onToolExecuted?: (tc: any, tr: any) => void } | undefined,
      ) => {
        callCount++
        if (callCount === 1) return { failed: { error: 'boom' } }
        wireStepDone(extra)
        return { returnValueResult: 'completed' }
      },
    )

    const workflow = createWorkflow()
    const options = createMockOptions({ resumeFromStep: 'build', initialStepOutput: {} })
    // launchWorkflowRun re-activates the blocked execution to 'running' first
    ;(options.sessionManager as any).getActiveWorkflowExecution = vi.fn(() => ({
      id: 'exec-1',
      sessionId: 'test-session',
      workflowId: 'test',
      workflowName: 'Test',
      status: 'running',
      stepOutput: {},
      params: {},
    }))

    const result = await executeWorkflow(workflow, options)

    expect(result.finalAction.type).toBe('DONE')
    expect(mockRunAgentTurn).toHaveBeenCalledTimes(2)
    // The run stayed tracked: the execution completed with the reused id
    const completeCall = (options.sessionManager as any).completeWorkflow.mock.calls[0] as unknown[]
    expect(completeCall[1]).toBe('exec-1')
  })
})

describe('evaluateLLMRetry', () => {
  const policy = {
    backoffMs: [1000, 5000, 30_000],
    minIntervalMs: 60_000,
    maxDurationMs: 30 * 60_000,
    maxAttempts: 40,
  }

  it('escalates delays through the backoff ladder, then holds at the steady interval', () => {
    const now = 1_000_000
    expect(evaluateLLMRetry(1, now, now, policy)).toEqual({ retry: true, delayMs: 1000, attempt: 2 })
    expect(evaluateLLMRetry(2, now, now, policy)).toEqual({ retry: true, delayMs: 5000, attempt: 3 })
    expect(evaluateLLMRetry(3, now, now, policy)).toEqual({ retry: true, delayMs: 30_000, attempt: 4 })
    expect(evaluateLLMRetry(4, now, now, policy)).toEqual({ retry: true, delayMs: 60_000, attempt: 5 })
    expect(evaluateLLMRetry(10, now, now, policy)).toEqual({ retry: true, delayMs: 60_000, attempt: 11 })
  })

  it('gives up once the retry window elapses', () => {
    const first = 1_000_000
    const before = first + 30 * 60_000 - 1
    const after = first + 30 * 60_000
    expect(evaluateLLMRetry(5, first, before, policy)).toEqual({ retry: true, delayMs: 60_000, attempt: 6 })
    expect(evaluateLLMRetry(5, first, after, policy)).toEqual({ retry: false })
  })

  it('gives up once the attempt backstop is reached', () => {
    const now = 1_000_000
    expect(evaluateLLMRetry(39, now, now, policy)).toEqual({ retry: true, delayMs: 60_000, attempt: 40 })
    expect(evaluateLLMRetry(40, now, now, policy)).toEqual({ retry: false })
  })
})
