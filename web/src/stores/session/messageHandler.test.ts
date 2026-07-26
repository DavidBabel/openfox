// @vitest-environment happy-dom
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

const {
  wsSendMock,
  wsSubscribeMock,
  wsConnectMock,
  wsDisconnectMock,
  wsStatusMock,
  playNotificationMock,
  playAchievementMock,
  playInterventionMock,
  playWaitingForUserMock,
  playNewMessageMock,
} = vi.hoisted(() => ({
  wsSendMock: vi.fn(() => 'message-id'),
  wsSubscribeMock: vi.fn(() => () => undefined),
  wsConnectMock: vi.fn(async () => undefined),
  wsDisconnectMock: vi.fn(() => undefined),
  wsStatusMock: vi.fn(() => undefined),
  playNotificationMock: vi.fn(),
  playAchievementMock: vi.fn(),
  playInterventionMock: vi.fn(),
  playWaitingForUserMock: vi.fn(),
  playNewMessageMock: vi.fn(),
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
  playNotification: playNotificationMock,
  playAchievement: playAchievementMock,
  playIntervention: playInterventionMock,
  playWaitingForUser: playWaitingForUserMock,
  playNewMessage: playNewMessageMock,
}))

type SessionStoreModule = typeof import('../session')

async function loadSessionStore(): Promise<SessionStoreModule['useSessionStore']> {
  vi.resetModules()
  const module = await import('../session')
  return module.useSessionStore
}

describe('session.name_generated handler', () => {
  beforeEach(() => {
    wsSendMock.mockClear()
    wsSubscribeMock.mockClear()
    wsConnectMock.mockClear()
    wsDisconnectMock.mockClear()
    wsStatusMock.mockClear()
    playNotificationMock.mockClear()
    playAchievementMock.mockClear()
    playInterventionMock.mockClear()
    playWaitingForUserMock.mockClear()
    playNewMessageMock.mockClear()
    fetchMock.mockClear()
  })

  it('should NOT modify updatedAt when a session name is generated', async () => {
    const useSessionStore = await loadSessionStore()

    const originalUpdatedAt = '2024-01-01T00:00:00.000Z'

    useSessionStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'session-1',
          projectId: 'project-1',
          workdir: '/tmp/test',
          mode: 'builder',
          phase: 'build',
          isRunning: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: originalUpdatedAt,
          criteriaCount: 0,
          criteriaCompleted: 0,
          messageCount: 0,
        } as any,
      ],
    }))

    useSessionStore.getState().handleServerMessage({
      type: 'session.name_generated',
      sessionId: 'session-1',
      payload: { name: 'My New Session Name' },
    })

    const state = useSessionStore.getState()
    expect(state.sessions[0]?.title).toBe('My New Session Name')
    expect(state.sessions[0]?.updatedAt).toBe(originalUpdatedAt)
  })

  it('should update the title without changing updatedAt on currentSession', async () => {
    const useSessionStore = await loadSessionStore()

    const originalUpdatedAt = '2024-06-15T10:30:00.000Z'

    useSessionStore.setState((state) => ({
      ...state,
      sessions: [
        {
          id: 'session-1',
          projectId: 'project-1',
          workdir: '/tmp/test',
          mode: 'builder',
          phase: 'build',
          isRunning: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: originalUpdatedAt,
          criteriaCount: 0,
          criteriaCompleted: 0,
          messageCount: 0,
        } as any,
      ],
      currentSession: {
        id: 'session-1',
        projectId: 'project-1',
        workdir: '/tmp/test',
        mode: 'builder',
        phase: 'build',
        isRunning: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: originalUpdatedAt,
        messages: [],
        criteria: [],
        contextWindows: [],
        executionState: null,
        metadata: { title: '', totalTokensUsed: 0, totalToolCalls: 0, iterationCount: 0 },
        metadataEntries: {},
      } as any,
    }))

    useSessionStore.getState().handleServerMessage({
      type: 'session.name_generated',
      sessionId: 'session-1',
      payload: { name: 'Renamed Session' },
    })

    const state = useSessionStore.getState()
    expect(state.currentSession?.metadata?.title).toBe('Renamed Session')
    expect(state.currentSession?.updatedAt).toBe(originalUpdatedAt)
    expect(state.sessions[0]?.updatedAt).toBe(originalUpdatedAt)
  })
})
