/**
 * Agent Loop – Soft LLM Failure Handling
 *
 * When the LLM stream reports an error (result.error), the agent loop must NOT
 * treat the turn as a legitimate completion: it finalizes the empty assistant
 * message with chat.done('error') and returns { failed: { error } } so the
 * workflow executor can roll the attempt back and retry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TurnMetrics } from './stream-pure.js'
import type { TopLevelLoopConfig } from './agent-loop.js'

vi.mock('../events/store.js', () => ({
  getEventStore: vi.fn(),
}))

vi.mock('../events/index.js', () => ({
  getCurrentContextWindowId: vi.fn(() => undefined),
  getCurrentWindowMessageOptions: vi.fn(() => undefined),
}))

vi.mock('../context/instructions.js', () => ({
  getAllInstructions: vi.fn(),
}))

vi.mock('../skills/registry.js', () => ({
  getEnabledSkillMetadata: vi.fn(),
}))

vi.mock('../runtime-config.js', () => ({
  getRuntimeConfig: vi.fn().mockReturnValue({
    mode: 'test',
    workdir: '/test',
    context: { compactionThreshold: 800000 },
    llm: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      timeout: 30000,
      idleTimeout: 30000,
      backend: 'ollama',
    },
  }),
}))

vi.mock('../../cli/paths.js', () => ({
  getGlobalConfigDir: vi.fn().mockReturnValue('/test/config'),
}))

vi.mock('./conversation-history.js', () => ({
  getConversationMessages: vi.fn().mockReturnValue([]),
}))

vi.mock('../context/compactor.js', () => ({
  shouldCompact: vi.fn(() => false),
  appendCompactionPrompt: vi.fn(),
}))

vi.mock('../agents/registry.js', () => ({
  loadAllAgentsDefault: vi.fn(async () => []),
  getSubAgents: vi.fn(() => []),
}))

vi.mock('../drain-queue.js', () => ({
  drainQueue: vi.fn(),
}))

vi.mock('../utils/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('./stream-pure.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./stream-pure.js')>()
  return {
    ...actual,
    streamLLMPure: vi.fn(),
    consumeStreamGenerator: vi.fn(),
  }
})

import { runTopLevelAgentLoop } from './agent-loop.js'
import { streamLLMPure, consumeStreamGenerator } from './stream-pure.js'

describe('agent loop soft LLM failure', () => {
  let mockSessionManager: any
  let mockLLMClient: any
  let mockTurnMetrics: TurnMetrics

  beforeEach(async () => {
    vi.clearAllMocks()

    mockSessionManager = {
      requireSession: vi.fn().mockReturnValue({
        workdir: '/test',
        projectId: 'test-project',
        executionState: null,
        criteria: [],
        isRunning: false,
      }),
      getEffectiveWorkdir: vi.fn().mockReturnValue('/test'),
      getProjectWorkdir: vi.fn().mockReturnValue('/test'),
      getContextState: vi.fn().mockReturnValue({
        currentTokens: 0,
        maxTokens: 128000,
        compactionCount: 0,
        dangerZone: false,
        canCompact: false,
        dynamicContextChanged: false,
      }),
      getCurrentModelContext: vi.fn().mockReturnValue(128000),
      getCurrentModelSettings: vi.fn().mockReturnValue({ maxTokens: 4096 }),
      getModelCompactionThreshold: vi.fn().mockReturnValue(800000),
      setCurrentContextSize: vi.fn(),
      getCachedPrompt: vi.fn().mockReturnValue(undefined),
      setCachedPrompt: vi.fn(),
    }

    mockLLMClient = { getModel: vi.fn().mockReturnValue('test-model') }
    mockTurnMetrics = {
      addToolTime: vi.fn(),
      addLLMCall: vi.fn(),
      buildStats: vi.fn().mockReturnValue({ durationMs: 0 }),
    } as unknown as TurnMetrics

    const { getAllInstructions } = await import('../context/instructions.js')
    const { getEnabledSkillMetadata } = await import('../skills/registry.js')
    ;(getAllInstructions as any).mockResolvedValue({ content: 'test instructions', files: [] })
    ;(getEnabledSkillMetadata as any).mockResolvedValue([])
  })

  function makeConfig(overrides?: Partial<TopLevelLoopConfig>): TopLevelLoopConfig {
    return {
      mode: 'planner',
      append: vi.fn(),
      sessionManager: mockSessionManager,
      sessionId: 'test-session',
      llmClient: mockLLMClient,
      statsIdentity: { providerId: 'test', providerName: 'Test', backend: 'unknown' as const, model: 'test-model' },
      assembleRequest: vi.fn().mockResolvedValue({ systemPrompt: 'sys', messages: [] }),
      getToolRegistry: () => ({ tools: [], definitions: [], execute: vi.fn() }) as any,
      getConversationMessages: vi.fn().mockResolvedValue([]),
      ...overrides,
    }
  }

  it('returns failed and finalizes the assistant message as an error when the LLM stream errors', async () => {
    ;(consumeStreamGenerator as any).mockResolvedValue({
      content: '',
      toolCalls: [],
      segments: [],
      usage: { promptTokens: 0, completionTokens: 0 },
      timing: { ttft: 0, completionTime: 0, tps: 0, prefillTps: 0 },
      aborted: false,
      modelParams: { temperature: 0, topP: 1, topK: 1, maxTokens: 4096 },
      finishReason: 'stop',
      error: 'LLM boom',
    })

    const append = vi.fn()
    const result = await runTopLevelAgentLoop(makeConfig({ append }), mockTurnMetrics)

    expect(result.failed?.error).toBe('LLM boom')
    // The empty assistant message is closed with chat.done('error'), not 'complete'
    const chatDone = append.mock.calls.map((c: any[]) => c[0]).filter((e: any) => e.type === 'chat.done')
    expect(chatDone[chatDone.length - 1]?.data.reason).toBe('error')
    // The turn still emitted its message.done so the frontend closes the bubble
    const msgDone = append.mock.calls.map((c: any[]) => c[0]).filter((e: any) => e.type === 'message.done')
    expect(msgDone.length).toBeGreaterThan(0)
  })

  it('still completes normally when there is no error', async () => {
    ;(consumeStreamGenerator as any).mockResolvedValue({
      content: 'all good',
      toolCalls: [],
      segments: [{ type: 'text', text: 'all good' }],
      usage: { promptTokens: 10, completionTokens: 5 },
      timing: { ttft: 1, completionTime: 1, tps: 1, prefillTps: 1 },
      aborted: false,
      modelParams: { temperature: 0, topP: 1, topK: 1, maxTokens: 4096 },
      finishReason: 'stop',
    })

    const append = vi.fn()
    const result = await runTopLevelAgentLoop(makeConfig({ append }), mockTurnMetrics)

    expect(result.failed).toBeUndefined()
    const chatDone = append.mock.calls.map((c: any[]) => c[0]).filter((e: any) => e.type === 'chat.done')
    expect(chatDone[chatDone.length - 1]?.data.reason).toBe('complete')
    expect(streamLLMPure).toHaveBeenCalledTimes(1)
  })
})
