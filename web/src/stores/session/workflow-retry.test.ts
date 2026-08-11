// @vitest-environment happy-dom
/**
 * Workflow Step Retry UI State
 *
 * - chat.step_retry → shows a live "retrying" indicator and clears any error
 * - chat.message_removed → drops rolled-back messages from the feed
 * - chat.done / execution state change → clears the retry indicator
 * - retryWorkflowStep → re-launches the workflow at the failed step
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('requestAnimationFrame', (cb: () => void) => setTimeout(cb, 0))
vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))

const fetchMock = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }), status: 200 }),
)
vi.stubGlobal('fetch', fetchMock)
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})

const { wsSendMock, wsSubscribeMock, wsConnectMock, wsDisconnectMock, wsStatusMock } = vi.hoisted(() => ({
  wsSendMock: vi.fn(() => 'message-id'),
  wsSubscribeMock: vi.fn(() => () => undefined),
  wsConnectMock: vi.fn(async () => undefined),
  wsDisconnectMock: vi.fn(() => undefined),
  wsStatusMock: vi.fn(() => undefined),
}))

vi.mock('../../lib/ws', () => ({
  wsClient: {
    send: wsSendMock,
    subscribe: wsSubscribeMock,
    connect: wsConnectMock,
    disconnect: wsDisconnectMock,
    onStatusChange: wsStatusMock,
  },
}))

vi.mock('../../lib/sound', () => ({
  playNotification: vi.fn(),
  playAchievement: vi.fn(),
  playIntervention: vi.fn(),
  playWaitingForUser: vi.fn(),
  playNewMessage: vi.fn(),
}))

type SessionStoreModule = typeof import('../session')

async function loadSessionStore(): Promise<SessionStoreModule['useSessionStore']> {
  vi.resetModules()
  const module = await import('../session')
  return module.useSessionStore
}

function makeSession(id: string) {
  return {
    id,
    projectId: 'project-1',
    workdir: '/tmp/project-1',
    mode: 'builder',
    phase: 'build',
    isRunning: false,
    criteria: [],
    summary: null,
    messages: [],
  } as any
}

function setBaseState(useSessionStore: any, session: any) {
  useSessionStore.setState((state: any) => ({
    ...state,
    currentSession: session,
    messages: [
      { id: 'failed-assistant-1', role: 'assistant', content: '', isStreaming: false },
      { id: 'keep-me', role: 'user', content: 'hi' },
    ],
    error: { code: 'CHAT_ERROR', message: 'LLM boom' },
    workflowRetry: null,
  }))
}

describe('workflow step retry UI state', () => {
  beforeEach(() => {
    wsSendMock.mockClear()
    wsSubscribeMock.mockClear()
    wsConnectMock.mockClear()
    wsDisconnectMock.mockClear()
    wsStatusMock.mockClear()
    fetchMock.mockClear()
  })

  it('chat.step_retry sets the retry indicator and clears the error banner', async () => {
    const useSessionStore = await loadSessionStore()
    setBaseState(useSessionStore, makeSession('session-1'))

    useSessionStore.getState().handleServerMessage({
      type: 'chat.step_retry',
      sessionId: 'session-1',
      payload: { stepName: 'Implement', attempt: 2, retryInMs: 4000 },
    })

    expect(useSessionStore.getState().workflowRetry).toEqual({
      stepName: 'Implement',
      attempt: 2,
      retryInMs: 4000,
    })
    expect(useSessionStore.getState().error).toBeNull()
  })

  it('chat.message_removed drops the rolled-back messages and clears the error', async () => {
    const useSessionStore = await loadSessionStore()
    setBaseState(useSessionStore, makeSession('session-1'))

    useSessionStore.getState().handleServerMessage({
      type: 'chat.message_removed',
      sessionId: 'session-1',
      payload: { messageIds: ['failed-assistant-1'] },
    })

    expect(useSessionStore.getState().messages.map((m: any) => m.id)).toEqual(['keep-me'])
    expect(useSessionStore.getState().error).toBeNull()
  })

  it('chat.done with a successful reason clears the retry indicator, an error reason does not', async () => {
    const useSessionStore = await loadSessionStore()
    setBaseState(useSessionStore, makeSession('session-1'))
    useSessionStore.setState((state: any) => ({
      ...state,
      workflowRetry: { stepName: 'Implement', attempt: 2, retryInMs: 4000 },
    }))

    // step_done → indicator cleared
    useSessionStore.getState().handleServerMessage({
      type: 'chat.done',
      sessionId: 'session-1',
      payload: { messageId: 'failed-assistant-1', reason: 'step_done' },
    })
    expect(useSessionStore.getState().workflowRetry).toBeNull()

    // back to retrying
    useSessionStore.setState((state: any) => ({
      ...state,
      workflowRetry: { stepName: 'Implement', attempt: 2, retryInMs: 4000 },
    }))
    // a failed turn's chat.done('error') must keep the indicator visible until step_retry re-fires
    useSessionStore.getState().handleServerMessage({
      type: 'chat.done',
      sessionId: 'session-1',
      payload: { messageId: 'failed-assistant-1', reason: 'error' },
    })
    expect(useSessionStore.getState().workflowRetry).not.toBeNull()
  })

  it('execution leaving the running state clears the retry indicator', async () => {
    const useSessionStore = await loadSessionStore()
    setBaseState(useSessionStore, makeSession('session-1'))
    useSessionStore.setState((state: any) => ({
      ...state,
      workflowRetry: { stepName: 'Implement', attempt: 3, retryInMs: 60000 },
      activeWorkflowExecution: {
        id: 'exec-1',
        sessionId: 'session-1',
        workflowId: 'default',
        workflowName: 'Build & Verify',
        status: 'running',
        currentStepId: 'build',
        stepOutput: {},
        params: {},
      },
    }))

    useSessionStore.getState().handleServerMessage({
      type: 'workflow.execution_changed',
      sessionId: 'session-1',
      payload: {
        executionId: 'exec-1',
        workflowId: 'default',
        workflowName: 'Build & Verify',
        status: 'blocked',
      },
    })

    expect(useSessionStore.getState().workflowRetry).toBeNull()
    expect(useSessionStore.getState().activeWorkflowExecution?.status).toBe('blocked')
  })

  it('resets the retry indicator when a session is (re)loaded', async () => {
    const useSessionStore = await loadSessionStore()
    setBaseState(useSessionStore, makeSession('session-1'))
    useSessionStore.setState((state: any) => ({
      ...state,
      workflowRetry: { stepName: 'Implement', attempt: 2, retryInMs: 4000 },
    }))

    useSessionStore.getState().handleServerMessage({
      type: 'session.state',
      id: 'msg-id',
      sessionId: 'session-1',
      payload: {
        session: makeSession('session-1'),
        messages: [],
        hiddenCount: 0,
        pendingConfirmations: [],
        pendingQuestions: [],
      },
    })

    expect(useSessionStore.getState().workflowRetry).toBeNull()
  })

  it('retryWorkflowStep re-launches the workflow at the current step and clears transient state', async () => {
    const useSessionStore = await loadSessionStore()
    setBaseState(useSessionStore, makeSession('session-1'))
    useSessionStore.setState((state: any) => ({
      ...state,
      activeWorkflowExecution: {
        id: 'exec-1',
        sessionId: 'session-1',
        workflowId: 'default',
        workflowName: 'Build & Verify',
        status: 'blocked',
        currentStepId: 'build',
        stepOutput: { content: 'x' },
        params: {},
      },
    }))

    useSessionStore.getState().retryWorkflowStep('session-1')

    expect(useSessionStore.getState().workflowRetry).toBeNull()
    expect(useSessionStore.getState().error).toBeNull()
    const call = wsSendMock.mock.calls[0] as unknown as [string, any] | undefined
    expect(call).toBeDefined()
    const [type, payload] = call!
    expect(type).toBe('runner.launch')
    expect(payload.resumeFrom).toBe('build')
    expect(payload.workflowId).toBe('default')
  })
})
