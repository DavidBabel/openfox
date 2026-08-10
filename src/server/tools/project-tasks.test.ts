import { mkdtemp, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../config.js'
import { closeDatabase, initDatabase } from '../db/index.js'
import { createProject } from '../db/projects.js'
import { createTasksService, type TasksService } from '../tasks/service.js'
import { projectTasksTool, setTasksService } from './project-tasks.js'
import type { ToolContext } from './types.js'

function makeContext(projectId: string): ToolContext {
  return {
    workdir: '/tmp',
    sessionId: 'sess-agent',
    sessionManager: {
      getSession: (id: string) => (id === 'sess-agent' ? { id, projectId } : null),
    } as unknown as ToolContext['sessionManager'],
  }
}

async function execute(action: string, args: Record<string, unknown>, projectId: string) {
  const ctx = makeContext(projectId)
  const result = await projectTasksTool.execute({ action, ...args }, ctx)
  return result
}

describe('project_tasks tool', () => {
  let root: string
  let projectId: string
  let service: TasksService

  beforeEach(async () => {
    closeDatabase()
    const config = loadConfig()
    config.database.path = ':memory:'
    initDatabase(config)
    root = await mkdtemp(join(tmpdir(), 'openfox-tool-tasks-'))
    await mkdir(join(root, 'nested'), { recursive: true })
    projectId = createProject('Tool Tasks', root).id

    const svc = createTasksService({
      sessionManager: {
        getSession: () => null,
        createSession: () => ({ id: 'unused' }),
        addMessage: () => undefined,
        queueMessage: () => undefined,
      } as unknown as Parameters<typeof createTasksService>[0]['sessionManager'],
      config: loadConfig(),
      broadcast: () => undefined,
      configDir: root,
    })
    service = svc
    setTasksService(svc)
  })

  afterEach(async () => {
    closeDatabase()
    await rm(root, { recursive: true, force: true })
  })

  it('creates a task with full parity', async () => {
    const result = await execute('create', { prompt: 'Write the docs' }, projectId)
    expect(result.success).toBe(true)
    const task = JSON.parse(result.output!) as { id: string; status: string; prompt: string }
    expect(task.status).toBe('todo')
    expect(task.prompt).toBe('Write the docs')
  })

  it('lists tasks and gate config', async () => {
    await execute('create', { prompt: 'A task' }, projectId)
    const result = await execute('list', {}, projectId)
    expect(result.success).toBe(true)
    const parsed = JSON.parse(result.output!) as { tasks: unknown[]; gates: unknown[] }
    expect(parsed.tasks).toHaveLength(1)
    expect(Array.isArray(parsed.gates)).toBe(true)
  })

  it('agent move binds the current session and surfaces the active session', async () => {
    const created = await execute('create', { prompt: 'Do it' }, projectId)
    const task = JSON.parse(created.output!) as { id: string }
    const moved = await execute('move', { taskId: task.id, to: 'in_progress' }, projectId)
    expect(moved.success).toBe(true)
    const movedTask = JSON.parse(moved.output!) as { boundSession: string; status: string }
    expect(movedTask.boundSession).toBe('sess-agent')
    expect(movedTask.status).toBe('in_progress')
  })

  it('surfaces the queue position of a queued task in list', async () => {
    // Agent moves always run, so seed the queued state via a human move:
    // first task occupies the single slot, the second queues behind it.
    const a = service.create(projectId, { prompt: 'A' }, { actor: 'human' })
    const b = service.create(projectId, { prompt: 'B' }, { actor: 'human' })
    await service.move(projectId, a.id, 'in_progress', { actor: 'human' })
    await service.move(projectId, b.id, 'in_progress', { actor: 'human' })

    const list = await execute('list', {}, projectId)
    const parsed = JSON.parse(list.output!) as { tasks: { id: string; queuePosition?: number; runState?: string }[] }
    const queued = parsed.tasks.find((t) => t.id === b.id)!
    expect(queued.runState).toBe('queued')
    expect(queued.queuePosition).toBe(1)
    // The running task has no queue position in the agent's view.
    const running = parsed.tasks.find((t) => t.id === a.id)!
    expect(running.queuePosition).toBeUndefined()
  })

  it('returns a structured gate error telling the agent to fill fields first', async () => {
    await execute(
      'set_gates',
      {
        gates: [{ id: 'commit', name: 'Commit', description: 'need a commit sha', required: true, variant: 'done' }],
      },
      projectId,
    )
    const created = await execute('create', { prompt: 'Ship' }, projectId)
    const task = JSON.parse(created.output!) as { id: string }
    await execute('move', { taskId: task.id, to: 'in_progress' }, projectId)

    const moved = await execute('move', { taskId: task.id, to: 'done' }, projectId)
    expect(moved.success).toBe(false)
    expect(moved.error).toContain('commit')
    expect(moved.error).toContain('set_gate_value')

    const filled = await execute('set_gate_value', { taskId: task.id, gateId: 'commit', value: 'abc123' }, projectId)
    expect(filled.success).toBe(true)
    const movedAgain = await execute('move', { taskId: task.id, to: 'done' }, projectId)
    expect(movedAgain.success).toBe(true)
  })

  it('denies a move when only the list action is permitted', async () => {
    const created = await execute('create', { prompt: 'Secret work' }, projectId)
    const task = JSON.parse(created.output!) as { id: string }

    const ctx = {
      ...makeContext(projectId),
      permittedActions: { project_tasks: ['list', 'get'] },
    }
    const denied = await projectTasksTool.execute({ action: 'move', taskId: task.id, to: 'in_progress' }, ctx)
    expect(denied.success).toBe(false)
    expect(denied.error).toContain('not allowed')
  })

  it('reports CONFLICT for a stale move', async () => {
    const created = await execute('create', { prompt: 'Race' }, projectId)
    const task = JSON.parse(created.output!) as { id: string; version: number }
    const stale = task.version
    await execute('edit', { taskId: task.id, prompt: 'Renamed' }, projectId)

    const moved = await execute('move', { taskId: task.id, to: 'in_progress', expectedVersion: stale }, projectId)
    expect(moved.success).toBe(false)
    expect(moved.error).toContain('refresh and retry')
  })

  it('duplicates and deletes', async () => {
    const created = await execute('create', { prompt: 'Original' }, projectId)
    const task = JSON.parse(created.output!) as { id: string }
    const dup = await execute('duplicate', { taskId: task.id }, projectId)
    expect(dup.success).toBe(true)
    const del = await execute('delete', { taskId: task.id }, projectId)
    expect(del.success).toBe(true)
    const list = await execute('list', {}, projectId)
    const parsed = JSON.parse(list.output!) as { tasks: { prompt: string }[] }
    expect(parsed.tasks).toHaveLength(1)
    expect(parsed.tasks[0]!.prompt).toBe('Original')
  })
})
