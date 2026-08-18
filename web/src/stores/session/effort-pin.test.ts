// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
})

const fetchMock = vi.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ session: { id: 's1' } }), status: 200 }),
)
vi.stubGlobal('fetch', fetchMock)

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

type SessionStoreModule = typeof import('../session')

async function loadSessionStore(): Promise<SessionStoreModule['useSessionStore']> {
  vi.resetModules()
  const module = await import('../session')
  return module.useSessionStore
}

async function seedSession(store: SessionStoreModule['useSessionStore']) {
  const session = {
    id: 's1',
    projectId: 'p1',
    workdir: '/tmp',
    mode: 'builder',
    phase: 'build',
    isRunning: false,
    criteria: [],
    summary: null,
    messages: [],
  }
  store.setState((state) => ({ ...state, currentSession: session }) as never)
}

function pinEffortCalls(): Array<[string, RequestInit]> {
  return (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).filter(([url]) =>
    url.includes('/api/sessions/s1/pin-effort'),
  )
}

describe('session store — pin/clear effort (criterion 0)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pinSessionEffort POSTs to /pin-effort and updates the pane session', async () => {
    const store = await loadSessionStore()
    await seedSession(store)

    const updated = await store.getState().pinSessionEffort('s1', 'high')
    expect(updated).toEqual({ id: 's1' })

    const calls = pinEffortCalls()
    expect(calls.length).toBe(1)
    expect(calls[0]![1].method).toBe('POST')
    expect(JSON.parse(String(calls[0]![1].body))).toEqual({ effort: 'high' })
  })

  it('pinSessionEffort returns null without a matching session', async () => {
    const store = await loadSessionStore()
    const result = await store.getState().pinSessionEffort('missing', 'high')
    expect(result).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clearSessionEffortPin DELETEs /pin-effort', async () => {
    const store = await loadSessionStore()
    await seedSession(store)

    await store.getState().clearSessionEffortPin('s1')

    const calls = pinEffortCalls()
    expect(calls.length).toBe(1)
    expect(calls[0]![1].method).toBe('DELETE')
  })
})
