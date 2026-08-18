// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { EffortChangeGateProvider } from '../components/plan/EffortChangeGate'
import type { ReactNode } from 'react'

const mockSwitchMode = vi.fn().mockResolvedValue(undefined)
const mockPinEffort = vi.fn().mockResolvedValue({})
const mockClearPin = vi.fn().mockResolvedValue({})

vi.mock('../stores/session', () => ({
  useSessionStore: (selector: (s: unknown) => unknown) =>
    selector({
      switchMode: mockSwitchMode,
      pinSessionEffort: mockPinEffort,
      clearSessionEffortPin: mockClearPin,
    }),
}))

let mockSessionMode = 'builder'
let mockWarmCache = true
let mockOverrides: Record<string, string> = {}

vi.mock('../stores/session/session-scope', () => ({
  useSessionScope: () => 'session-1',
  useScopedPaneState: (_id: string, _pick: unknown, flatPick: (s: unknown) => unknown) =>
    flatPick({
      currentSession: { id: 'session-1', mode: mockSessionMode, providerReasoningEffort: 'high' },
      contextState: { warmCache: mockWarmCache },
    }),
}))

vi.mock('../stores/agents', () => ({
  useAgentsStore: (selector: (s: unknown) => unknown) => selector({ modelOverrides: mockOverrides }),
}))

vi.mock('../stores/config', () => ({
  useConfigStore: (selector: (s: unknown) => unknown) => selector({ providers: [], defaultModelSelection: null }),
}))

import { useEffortGatedAgentSwitch } from './useEffortGateContext'

function wrapper({ children }: { children: ReactNode }) {
  return <EffortChangeGateProvider>{children}</EffortChangeGateProvider>
}

describe('useEffortGatedAgentSwitch (criterion 4 — all agent-selection entry points)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOverrides = {}
    mockSessionMode = 'builder'
    mockWarmCache = true
  })

  it('switches directly when the target agent has no effort override', async () => {
    const { result } = renderHook(() => useEffortGatedAgentSwitch(), { wrapper })
    await result.current('explorer', 'Explorer')
    expect(mockSwitchMode).toHaveBeenCalledWith('session-1', 'explorer')
    expect(mockPinEffort).not.toHaveBeenCalled()
    expect(mockClearPin).not.toHaveBeenCalled()
  })

  it('switches directly when the override effort matches the current effort', async () => {
    mockOverrides = { explorer: 'provider-1/model:high' }
    const { result } = renderHook(() => useEffortGatedAgentSwitch(), { wrapper })
    await result.current('explorer', 'Explorer')
    expect(mockSwitchMode).toHaveBeenCalledWith('session-1', 'explorer')
  })

  it('switches directly on a cold cache', async () => {
    mockOverrides = { explorer: 'provider-1/model:max' }
    mockWarmCache = false
    const { result } = renderHook(() => useEffortGatedAgentSwitch(), { wrapper })
    await result.current('explorer', 'Explorer')
    expect(mockSwitchMode).toHaveBeenCalledWith('session-1', 'explorer')
  })

  it('gates and clears the pin on Apply, then switches mode', async () => {
    mockOverrides = { explorer: 'provider-1/model:max' }
    const { result } = renderHook(() => useEffortGatedAgentSwitch(), { wrapper })
    const switching = result.current('explorer', 'Explorer')

    await vi.waitFor(() => expect(document.body.textContent).toContain('Reasoning effort change'))
    expect(mockSwitchMode).not.toHaveBeenCalled()

    const applyButton = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Apply the reasoning effort'),
    )
    applyButton?.click()
    await switching
    expect(mockClearPin).toHaveBeenCalledWith('session-1')
    expect(mockPinEffort).not.toHaveBeenCalled()
    expect(mockSwitchMode).toHaveBeenCalledWith('session-1', 'explorer')
  })

  it('gates and pins the current effort on Keep, then switches mode', async () => {
    mockOverrides = { explorer: 'provider-1/model:max' }
    const { result } = renderHook(() => useEffortGatedAgentSwitch(), { wrapper })
    const switching = result.current('explorer', 'Explorer')

    await vi.waitFor(() => expect(document.body.textContent).toContain('Reasoning effort change'))

    const keepButton = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Keep current reasoning effort'),
    )
    keepButton?.click()
    await switching
    expect(mockPinEffort).toHaveBeenCalledWith('session-1', 'high')
    expect(mockClearPin).not.toHaveBeenCalled()
    expect(mockSwitchMode).toHaveBeenCalledWith('session-1', 'explorer')
  })
})
