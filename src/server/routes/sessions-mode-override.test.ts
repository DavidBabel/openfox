/**
 * Mode Switch + Agent Model Override Tests
 *
 * Tests that switching to an agent with a model override auto-sets
 * session.providerId and session.providerModel (last-write-wins).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import { type Server } from 'node:http'
import { closeDatabase, getDatabase, initDatabase } from '../db/index.js'
import { loadConfig } from '../config.js'
import { createProject } from '../db/projects.js'
import { initEventStore } from '../events/index.js'
import { SessionManager } from '../session/manager.js'
import { setAgentModelOverride } from '../agents/model-overrides.js'
import { getSession } from '../db/sessions.js'

describe('PUT /api/sessions/:id/mode — agent model override', () => {
  let server: Server
  let baseUrl: string
  let sessionManager: SessionManager
  let sessionId: string

  const mockProviderManager = {
    getCurrentModelContext: () => 200000,
    getLLMClient: () => ({
      getModel: () => 'global-model',
      setModel: () => {},
      getProfile: () => {},
      getBackend: () => 'unknown',
      setBackend: () => {},
      complete: async () => {},
      stream: async function* () {},
    }),
    getActiveProviderId: () => 'test-provider',
    getCurrentModel: () => 'global-model',
    createClient: () => undefined,
    getProviders: () => [],
  }

  beforeEach(async () => {
    closeDatabase()
    const config = loadConfig()
    config.database.path = ':memory:'
    initDatabase(config)
    initEventStore(getDatabase())

    const workdir = '/tmp/test'
    const projectId = createProject('Test', workdir).id

    sessionManager = new SessionManager(mockProviderManager as any)
    const session = sessionManager.createSession(projectId)
    sessionId = session.id

    const app = express()
    app.use(express.json())

    // Mini mode switch handler matching the real one
    app.put('/api/sessions/:id/mode', async (req, res) => {
      const { getAgentModelOverride: getOverride } = await import('../agents/model-overrides.js')
      const { updateSessionProvider } = await import('../db/sessions.js')

      const sid = req.params.id
      const sess = sessionManager.getSession(sid)
      if (!sess) return res.status(404).json({ error: 'Session not found' })

      const { mode } = req.body
      if (!mode) return res.status(400).json({ error: 'mode is required' })

      sessionManager.setMode(sid, mode)

      // Auto-set session provider/model: override if agent has one, else reset to default
      const override = getOverride(mode)
      if (override) {
        updateSessionProvider(sid, override.providerId, override.model)
      } else {
        updateSessionProvider(sid, null, null)
      }

      const updated = sessionManager.getSession(sid)
      res.json({ session: updated })
    })

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${(server.address() as { port: number }).port}`
        resolve()
      })
    })
  })

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
    closeDatabase()
  })

  it('sets session provider/model when agent has override', async () => {
    setAgentModelOverride('planner', { providerId: 'my-provider', model: 'my-model' })

    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'planner' }),
    })
    expect(res.status).toBe(200)

    const session = getSession(sessionId)
    expect(session?.providerId).toBe('my-provider')
    expect(session?.providerModel).toBe('my-model')
  })

  it('leaves session provider/model unchanged when agent has no override', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'planner' }),
    })
    expect(res.status).toBe(200)

    const session = getSession(sessionId)
    expect(session?.providerId).toBeNull()
    expect(session?.providerModel).toBeNull()
  })

  it('switch to agent without override resets to default', async () => {
    // Set a manual override on the session
    const { updateSessionProvider } = await import('../db/sessions.js')
    updateSessionProvider(sessionId, 'manual-provider', 'manual-model')

    // Switch to an agent without override — resets to default
    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'planner' }),
    })
    expect(res.status).toBe(200)

    const session = getSession(sessionId)
    expect(session?.providerId).toBeNull()
    expect(session?.providerModel).toBeNull()
  })

  it('switching back to agent reapplies override', async () => {
    setAgentModelOverride('planner', { providerId: 'agent-provider', model: 'agent-model' })

    // Switch to planner — override applied
    await fetch(`${baseUrl}/api/sessions/${sessionId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'planner' }),
    })

    let session = getSession(sessionId)
    expect(session?.providerModel).toBe('agent-model')

    // Switch to builder (no override) — resets to default
    await fetch(`${baseUrl}/api/sessions/${sessionId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'builder' }),
    })

    session = getSession(sessionId)
    expect(session?.providerModel).toBeNull()

    // Switch back to planner — override reapplied (last write wins)
    await fetch(`${baseUrl}/api/sessions/${sessionId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'planner' }),
    })

    session = getSession(sessionId)
    expect(session?.providerModel).toBe('agent-model')
  })

  it('handles missing override gracefully (no crash)', async () => {
    // Don't set any override, just switch to a valid agent
    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/mode`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'builder' }),
    })
    expect(res.status).toBe(200)
  })
})
