import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authFetch } from './api'
import { clearCache } from './resourceCache'
import { agentsResource, readAgents } from './resources'

vi.mock('./api', () => ({
  authFetch: vi.fn(),
}))

function jsonResponse(data: unknown): Response {
  return { ok: true, json: () => Promise.resolve(data) } as unknown as Response
}

describe('agentsResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCache()
  })

  it('scopes the cache key by workdir so wrong-scope data is impossible', () => {
    expect(agentsResource.keyOf('/repo/a')).toBe('agents:/repo/a')
    expect(agentsResource.keyOf('/repo/b')).toBe('agents:/repo/b')
    expect(agentsResource.keyOf(undefined)).toBe('agents:')
    expect(agentsResource.keyOf('/repo/a')).not.toBe(agentsResource.keyOf(undefined))
  })

  it('fetches the agents list scoped to the requested workdir', async () => {
    vi.mocked(authFetch).mockResolvedValue(jsonResponse({ defaults: [] }))
    await agentsResource.refresh('/repo/a')
    expect(authFetch).toHaveBeenCalledWith('/api/agents?workdir=%2Frepo%2Fa')
  })

  it('keeps different workdir scopes isolated in the cache', async () => {
    vi.mocked(authFetch).mockImplementation(async (url: string) => {
      const workdir = url.includes('?workdir=') ? decodeURIComponent(url.split('=')[1] ?? '') : ''
      return jsonResponse({ defaults: [{ id: workdir }] })
    })
    await agentsResource.refresh('/repo/a')
    await agentsResource.refresh('/repo/b')

    expect(readAgents('/repo/a')?.defaults[0]?.id).toBe('/repo/a')
    expect(readAgents('/repo/b')?.defaults[0]?.id).toBe('/repo/b')
    expect(readAgents('/repo/c')).toBeUndefined()
  })

  it('readAgents is undefined for a scope that was never loaded', () => {
    expect(readAgents('/nowhere')).toBeUndefined()
  })

  it('normalizes missing response fields to empty collections', async () => {
    vi.mocked(authFetch).mockResolvedValue(jsonResponse({}))
    await agentsResource.refresh(undefined)
    expect(readAgents(undefined)).toEqual({
      defaults: [],
      userItems: [],
      projectItems: [],
      modelOverrides: {},
    })
  })
})
