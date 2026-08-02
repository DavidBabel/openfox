/**
 * Session Manager – Workspace Switch & Execution Context Integrity Tests
 *
 * Cache discipline: the cached system prompt is SACRED for local LLMs — OpenFox
 * never invalidates it on workspace or branch mutation. Those tests pin that
 * switchWorkspace:
 *   - MUST preserve the cached prompt untouched after a workspace/branch switch,
 *     so the next LLM call reuses it instead of paying a full rebuild.
 *   - MUST inject a workspace system reminder (<system-reminder> auto-prompt)
 *     carrying the new workspace/branch, which the model is instructed to trust
 *     over the static "Working directory" line in the cached prompt.
 *   - MUST emit a fresh session.updated event so the frontend never displays
 *     a stale workspace/branch label after an authoritative mutation.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const {
  mockGetGitBranch,
  mockGetWorkspacesDir,
  mockRunGit,
  mockGetCommitsBehind,
  mockEnsureWorkspace,
  mockWorkspaceExists,
} = vi.hoisted(() => {
  const mockGetGitBranch = vi.fn(async (_cwd: string) => 'feat-x' as string | null)
  const mockGetWorkspacesDir = vi.fn(async (_projectName: string, _projectDir: string) => '/tmp/openfox-workspaces')
  const mockRunGit = vi.fn(async (_cwd: string, _args: string[]) => undefined as void)
  const mockGetCommitsBehind = vi.fn(async (_cwd: string, _branch: string) => 0 as number | null)
  const mockEnsureWorkspace = vi.fn(async () => undefined)
  const mockWorkspaceExists = vi.fn(async () => true)
  return {
    mockGetGitBranch,
    mockGetWorkspacesDir,
    mockRunGit,
    mockGetCommitsBehind,
    mockEnsureWorkspace,
    mockWorkspaceExists,
  }
})

vi.mock('../lsp/index.js', () => ({
  getLspManager: vi.fn(() => ({ name: 'mock-lsp' })),
  shutdownLspManager: vi.fn(async () => {}),
}))

vi.mock('../git/workspace.js', async (importOriginal) => {
  const actual = (await importOriginal()) as any
  return {
    ...actual,
    getGitBranch: mockGetGitBranch as any,
    getWorkspacesDir: mockGetWorkspacesDir as any,
    runGit: mockRunGit as any,
    getCommitsBehind: mockGetCommitsBehind as any,
    ensureWorkspace: mockEnsureWorkspace as any,
    workspaceExists: mockWorkspaceExists as any,
    validateRef: vi.fn(async () => undefined),
    resolveAndValidateSourceBranch: vi.fn(async () => 'origin/HEAD'),
  }
})

vi.mock('../dev-server/manager.js', () => ({
  devServerManager: { stop: vi.fn(async () => undefined) },
}))

const mockProviderManager = {
  getCurrentModelContext: vi.fn(() => 200000),
  getLLMClient: vi.fn(() => ({})),
  createClient: vi.fn(() => undefined),
  getActiveProviderId: vi.fn(() => 'test-provider'),
  getCurrentModel: vi.fn(() => 'global-model'),
}

import { loadConfig } from '../config.js'
import { closeDatabase, getDatabase, initDatabase } from '../db/index.js'
import { createProject } from '../db/projects.js'
import { updateSessionBranch } from '../db/sessions.js'
import { initEventStore } from '../events/index.js'
import { SessionManager } from './manager.js'

async function setSessionBranch(manager: SessionManager, sessionId: string, branch: string) {
  updateSessionBranch(sessionId, branch)
  // Force the manager to reload from DB so session.branch reflects the write
  await new Promise<void>((resolve) => setImmediate(resolve))
  expect(manager.getSession(sessionId)?.branch).toBe(branch)
}

describe('SessionManager.switchWorkspace – execution context integrity (issue #190)', () => {
  let workdir: string
  let projectId: string
  let manager: SessionManager

  beforeEach(async () => {
    closeDatabase()
    const config = loadConfig()
    config.database.path = ':memory:'
    initDatabase(config)
    initEventStore(getDatabase())

    workdir = await mkdtemp(join(tmpdir(), 'openfox-manager-exec-ctx-'))
    projectId = createProject('OpenFox', workdir).id
    manager = new SessionManager(mockProviderManager as any)

    mockGetGitBranch.mockClear()
    mockGetGitBranch.mockResolvedValue('feat-x')
    mockGetWorkspacesDir.mockClear()
    mockGetWorkspacesDir.mockResolvedValue('/tmp/openfox-workspaces')
    mockRunGit.mockClear()
    mockRunGit.mockResolvedValue(undefined)
    mockGetCommitsBehind.mockClear()
    mockGetCommitsBehind.mockResolvedValue(0)
    mockEnsureWorkspace.mockReset()
    mockEnsureWorkspace.mockResolvedValue(undefined)
    mockWorkspaceExists.mockReset()
    mockWorkspaceExists.mockResolvedValue(true)
  })

  afterEach(async () => {
    closeDatabase()
    await rm(workdir, { recursive: true, force: true })
  })

  it('preserves the cached prompt after a successful workspace switch (system reminder carries the new context)', async () => {
    // Session starts on /tmp/project (original workdir) with no workspace
    const session = manager.createSession(projectId, 'Ctx-1')

    // Simulate that the previous turn warmed up the prompt with the OLD workdir.
    // The cached prompt embeds `Working directory: /tmp/project` — the stale
    // state. This is exactly what buildTopLevelSystemPrompt(workdir) does.
    manager.setCachedPrompt(session.id, 'System prompt with Working directory: /tmp/project', [], 'old-hash')
    expect(manager.getCachedPrompt(session.id)).toBeDefined()

    // Authoritative mutation: switch to workspace feat-x (it exists)
    await manager.switchWorkspace(session.id, 'feat-x')

    // The cache is sacred — it must survive the switch untouched so the next LLM
    // call reuses it instead of paying a full rebuild.
    const cachedAfter = manager.getCachedPrompt(session.id)
    expect(cachedAfter).toBeDefined()
    expect(cachedAfter?.hash).toBe('old-hash')
    expect(cachedAfter?.systemPrompt).toBe('System prompt with Working directory: /tmp/project')

    // The new workspace/branch reaches the model via an injected system reminder.
    const messages = manager.getSession(session.id)!.messages
    const reminders = messages.filter((m) => m.messageKind === 'auto-prompt')
    expect(reminders.length).toBeGreaterThan(0)
    expect(reminders[reminders.length - 1]!.content).toContain('feat-x')
  })

  it('preserves the cached prompt after a successful branch change on the current workspace (same-turn sees fresh context)', async () => {
    // Session currently on /ws/openfox/feat-x with branch=feat-x (default mock)
    const session = manager.createSession(projectId, 'Ctx-2', undefined, undefined, '/ws/openfox/feat-x')
    // Pre-seed a cached prompt referencing branch=feat-x workdir
    manager.setCachedPrompt(session.id, 'System prompt with Working directory: /ws/openfox/feat-x', [], 'feat-hash')
    expect(manager.getCachedPrompt(session.id)).toBeDefined()

    // Branch change: same workspace, different branch. The first getGitBranch
    // call (early-return check) sees the PRE-mutation branch 'feat-x', so the
    // switch is NOT a no-op. Subsequent getGitBranch calls return 'feat-y'
    // to simulate a successful applyBranchIfNeeded.
    mockGetGitBranch.mockResolvedValueOnce('feat-x')
    mockGetGitBranch.mockResolvedValue('feat-y')
    await manager.switchWorkspace(session.id, 'feat-x', 'feat-y')

    // The cached prompt must survive so the next LLM call reuses it — the new
    // branch travels via the injected system reminder instead.
    const cachedAfter = manager.getCachedPrompt(session.id)
    expect(cachedAfter).toBeDefined()
    expect(cachedAfter?.hash).toBe('feat-hash')

    const messages = manager.getSession(session.id)!.messages
    const reminders = messages.filter((m) => m.messageKind === 'auto-prompt')
    expect(reminders.length).toBeGreaterThan(0)
    expect(reminders[reminders.length - 1]!.content).toContain('feat-y')
  })

  it('does not invalidate the cached prompt when switchWorkspace is a no-op (no real mutation)', async () => {
    // Session already on /ws/openfox/feat-x — switching to feat-x without branch change
    // is a no-op and must NOT manufacture a fake refreshed context.
    const session = manager.createSession(projectId, 'Ctx-3', undefined, undefined, '/ws/openfox/feat-x')
    manager.setCachedPrompt(
      session.id,
      'Stable system prompt with Working directory: /ws/openfox/feat-x',
      [],
      'stable-hash',
    )

    await manager.switchWorkspace(session.id, 'feat-x')

    // Cache should be untouched on a no-op mutation
    const cached = manager.getCachedPrompt(session.id)
    expect(cached).toBeDefined()
    expect(cached?.hash).toBe('stable-hash')
  })

  // ==========================================================================
  // Workspace branch inheritance — a fresh workspace must not silently drop
  // the session's current branch onto the clone's default (main/develop).
  // ==========================================================================

  describe('workspace branch inheritance', () => {
    it('carries the session branch into a newly created workspace when no branch is given', async () => {
      const session = manager.createSession(projectId, 'Ctx-inherit-1')
      await setSessionBranch(manager, session.id, 'feat-x')
      mockWorkspaceExists.mockResolvedValue(false)
      mockEnsureWorkspace.mockClear()

      await manager.switchWorkspace(session.id, 'brand-new-ws')

      expect(mockEnsureWorkspace).toHaveBeenCalledWith(workdir, 'brand-new-ws', 'OpenFox', 'feat-x', undefined)
    })

    it('does not force a branch checkout into an existing workspace when no branch is given', async () => {
      const session = manager.createSession(projectId, 'Ctx-inherit-2', undefined, undefined, '/ws/openfox/feat-x')
      mockEnsureWorkspace.mockClear()

      await manager.switchWorkspace(session.id, 'feat-x')

      expect(mockEnsureWorkspace).not.toHaveBeenCalled()
    })
  })
})
