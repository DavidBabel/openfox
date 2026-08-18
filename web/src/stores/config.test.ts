// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authFetch } from '../lib/api'
import { useConfigStore } from './config'

vi.mock('../lib/api', () => ({
  authFetch: vi.fn(),
}))

function jsonResponse(data: unknown = {}, ok = true): Response {
  return { ok, json: () => Promise.resolve(data) } as Response
}

describe('ConfigStore updateModelSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useConfigStore.setState({
      providers: [
        {
          id: 'provider-1',
          name: 'OpenAI',
          url: 'https://api.openai.com/v1',
          backend: 'openai',
          isActive: true,
          createdAt: '2026-01-01T00:00:00.000Z',
          models: [
            {
              id: 'gpt-4',
              contextWindow: 128000,
              source: 'user',
              reasoningEfforts: ['low', 'medium', 'high'],
              thinkingEnabled: true,
              thinkingLevel: 'medium',
            },
          ],
        },
      ],
      activeProviderId: 'provider-1',
    })
  })

  it('PUTs the settings and applies them to the local provider state', async () => {
    vi.mocked(authFetch).mockResolvedValue(jsonResponse({ success: true }))
    const ok = await useConfigStore.getState().updateModelSettings('provider-1', 'gpt-4', {
      thinkingLevel: 'high',
      thinkingEnabled: true,
    })
    expect(ok).toBe(true)
    expect(authFetch).toHaveBeenCalledWith(
      '/api/providers/provider-1/models/gpt-4/settings',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ thinkingLevel: 'high', thinkingEnabled: true }),
      }),
    )
    const model = useConfigStore.getState().providers[0]!.models[0]!
    expect(model.thinkingLevel).toBe('high')
    expect(model.thinkingEnabled).toBe(true)
  })

  it('returns false when the request fails', async () => {
    vi.mocked(authFetch).mockResolvedValue(jsonResponse({}, false))
    const ok = await useConfigStore.getState().updateModelSettings('provider-1', 'gpt-4', {
      thinkingLevel: 'high',
    })
    expect(ok).toBe(false)
  })

  it('returns false when the request throws', async () => {
    vi.mocked(authFetch).mockRejectedValue(new Error('network'))
    const ok = await useConfigStore.getState().updateModelSettings('provider-1', 'gpt-4', {
      thinkingLevel: 'high',
    })
    expect(ok).toBe(false)
  })
})
