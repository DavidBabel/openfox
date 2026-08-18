/**
 * Provider Configuration REST API E2E Tests
 *
 * Tests session provider/model configuration via REST API.
 * Following TDD: these tests should FAIL initially before implementation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createTestServer, type TestServerHandle } from './utils/index.js'
import { createTestProject, type TestProject } from './utils/index.js'
import { loadGlobalConfig } from '../src/cli/config.js'

describe('Provider Configuration REST API', () => {
  let server: TestServerHandle
  let testProject: TestProject
  let projectId: string
  let sessionId: string

  beforeAll(async () => {
    server = await createTestServer()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(async () => {
    testProject = await createTestProject({ template: 'empty' })
    // Create a project via REST
    const createRes = await fetch(`${server.url}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Project', workdir: testProject.path }),
    })
    const data: any = await createRes.json()
    projectId = data.project.id

    // Create a session
    const sessionRes = await fetch(`${server.url}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, title: 'Test Session' }),
    })
    const sessionData: any = await sessionRes.json()
    sessionId = sessionData.session.id
  })

  afterEach(async () => {
    await testProject.cleanup()
  })

  describe('POST /api/sessions/:id/provider', () => {
    it('sets session provider and model', async () => {
      // Get available providers first
      const providersRes = await fetch(`${server.url}/api/providers`)
      const providersData: any = await providersRes.json()
      const providerId = providersData.providers?.[0]?.id ?? providersData.activeProviderId

      if (!providerId) {
        // Skip test if no providers available (mock mode)
        console.log('No providers available, skipping test')
        return
      }

      // Set provider for session
      const response = await fetch(`${server.url}/api/sessions/${sessionId}/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })

      expect(response.status).toBe(200)
      const data: any = await response.json()
      expect(data.session.providerId).toBe(providerId)
    })

    it('updates context state with new maxTokens', async () => {
      // Get available providers first
      const providersRes = await fetch(`${server.url}/api/providers`)
      const providersData: any = await providersRes.json()
      const providerId = providersData.providers?.[0]?.id ?? providersData.activeProviderId

      if (!providerId) {
        // Skip test if no providers available (mock mode)
        console.log('No providers available, skipping test')
        return
      }

      // Set provider for session
      const response = await fetch(`${server.url}/api/sessions/${sessionId}/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })

      expect(response.status).toBe(200)
      const data: any = await response.json()

      // Context state should be included
      expect(data.contextState).toBeDefined()
      expect(data.contextState.maxTokens).toBeGreaterThan(0)
    })

    it('returns 404 for non-existent session', async () => {
      const providersRes = await fetch(`${server.url}/api/providers`)
      const providersData: any = await providersRes.json()
      const providerId = providersData.activeProviderId

      const response = await fetch(`${server.url}/api/sessions/nonexistent-id/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId }),
      })

      expect(response.status).toBe(404)
    })

    it('returns 400 for missing providerId', async () => {
      const response = await fetch(`${server.url}/api/sessions/${sessionId}/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      const data: any = await response.json()
      expect(data.error).toBeDefined()
    })
  })

  describe('PUT /api/providers/:id/models/:modelId/settings', () => {
    async function createProvider(models: Record<string, unknown>[]): Promise<string> {
      const createRes = await fetch(`${server.url}/api/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Settings Test Provider',
          url: 'http://127.0.0.1:9/v1',
          backend: 'openai',
          models,
          isActive: true,
        }),
      })
      expect(createRes.status).toBe(201)
      const createData = (await createRes.json()) as { success: boolean; provider: { id: string } }
      return createData.provider.id
    }

    it('persists thinkingLevel and thinkingEnabled to the config file and in-memory state', async () => {
      const providerId = await createProvider([
        {
          id: 'gpt-4',
          contextWindow: 128000,
          reasoningEfforts: ['low', 'medium', 'high'],
          thinkingEnabled: true,
          thinkingLevel: 'medium',
        },
      ])

      const response = await fetch(`${server.url}/api/providers/${providerId}/models/gpt-4/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thinkingLevel: 'high', thinkingEnabled: true }),
      })
      expect(response.status).toBe(200)
      const data: any = await response.json()
      expect(data.success).toBe(true)
      expect(data.model.thinkingLevel).toBe('high')

      // Survives a restart: the isolated config file carries the new default.
      const config = await loadGlobalConfig('test', server.globalConfigPath)
      const provider = config.providers?.find((p) => p.id === providerId)
      const model = provider?.models.find((m) => m.id === 'gpt-4')
      expect(model?.thinkingLevel).toBe('high')
      expect(model?.thinkingEnabled).toBe(true)

      // In-memory provider state reflects the update for immediate use.
      const providersRes = await fetch(`${server.url}/api/providers`)
      const providersData: any = await providersRes.json()
      const inMemModel = providersData.providers
        .find((p: any) => p.id === providerId)
        .models.find((m: any) => m.id === 'gpt-4')
      expect(inMemModel.thinkingLevel).toBe('high')
    })

    it('returns 404 for an unknown provider', async () => {
      const response = await fetch(`${server.url}/api/providers/unknown-id/models/gpt-4/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thinkingLevel: 'high' }),
      })
      expect(response.status).toBe(404)
    })

    it('returns 404 for an unknown model', async () => {
      const providerId = await createProvider([
        { id: 'gpt-4', contextWindow: 128000, thinkingEnabled: true, thinkingLevel: 'medium' },
      ])
      const response = await fetch(`${server.url}/api/providers/${providerId}/models/nope/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thinkingLevel: 'high' }),
      })
      expect(response.status).toBe(404)
    })

    it('returns 400 for an out-of-vocabulary effort value', async () => {
      const providerId = await createProvider([
        { id: 'gpt-4', contextWindow: 128000, thinkingEnabled: true, thinkingLevel: 'medium' },
      ])
      const response = await fetch(`${server.url}/api/providers/${providerId}/models/gpt-4/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thinkingLevel: 'bogus' }),
      })
      expect(response.status).toBe(400)
    })
  })
})
