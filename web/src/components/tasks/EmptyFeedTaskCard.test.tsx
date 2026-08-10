// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EmptyFeedTaskCard } from './EmptyFeedTaskCard'
import { useTasksStore } from '../../stores/tasks'
import { authFetch } from '../../lib/api'

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(),
}))

const task = (
  overrides: Partial<import('@shared/types.js').ProjectTask> = {},
): import('@shared/types.js').ProjectTask => ({
  id: 't1',
  projectId: 'proj-1',
  prompt: 'Investigate the redirect bug',
  attachments: [],
  status: 'todo',
  position: 0,
  version: 1,
  sessionIds: [],
  gateValues: [],
  auditTrail: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

describe('EmptyFeedTaskCard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    useTasksStore.setState({
      tasks: [],
      gates: [],
      settings: { slotLimit: 1, queuePaused: false },
      counts: { open: 0, todo: 0, inProgress: 0, running: 0, queued: 0, done: 0 },
      activeProjectId: 'proj-1',
      lastError: null,
      lastAutoLaunch: null,
    })
    vi.mocked(authFetch).mockReset()
  })

  it('shows nothing when no open unclaimed task exists', () => {
    useTasksStore.setState({ tasks: [], activeProjectId: 'proj-1' })
    const { container } = render(<EmptyFeedTaskCard projectId="proj-1" />)
    expect(container.textContent).not.toContain('Work on next task')
  })

  it('previews the topmost unclaimed To Do task and claims it on click', async () => {
    vi.mocked(authFetch).mockImplementation(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response)
    useTasksStore.setState({
      activeProjectId: 'proj-1',
      tasks: [
        task({ id: 'later', prompt: 'Later task', position: 1 }),
        task({ id: 'top', prompt: 'Investigate the redirect bug', position: 0 }),
        task({ id: 'claimed', prompt: 'Bound elsewhere', position: 2, sessionIds: ['sess-x'] }),
      ],
    })

    const { container } = render(<EmptyFeedTaskCard projectId="proj-1" />)
    expect(container.textContent).toContain('Work on next task')
    expect(screen.getByText('Investigate the redirect bug')).toBeTruthy()

    // Move succeeds and returns a session to navigate to
    vi.mocked(authFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task: task({ id: 'top', status: 'in_progress', runState: 'running' }),
        sessionId: 'sess-new',
      }),
    } as unknown as Response)
    fireEvent.click(screen.getByText('Start task'))
    await waitFor(() => {
      expect(vi.mocked(authFetch)).toHaveBeenCalledWith(
        '/api/projects/proj-1/tasks/top/move',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  it('confirms the claim visibly when it lands in the queue (no free slot)', async () => {
    vi.mocked(authFetch).mockImplementation(async () => ({ ok: true, json: async () => ({}) }) as unknown as Response)
    useTasksStore.setState({
      activeProjectId: 'proj-1',
      tasks: [task({ id: 'top', prompt: 'Investigate the redirect bug', position: 0 })],
    })

    render(<EmptyFeedTaskCard projectId="proj-1" />)
    // Claim returns no session — the task queued instead of launching.
    vi.mocked(authFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ task: task({ id: 'top', status: 'in_progress', runState: 'queued', queuePosition: 1 }) }),
    } as unknown as Response)

    fireEvent.click(screen.getByText('Start task'))
    await waitFor(() => {
      expect(screen.getByText(/Investigate the redirect bug.*queued/i)).toBeTruthy()
    })
    // The feedback is dismissible and the card recovers.
    fireEvent.click(screen.getByTitle('Dismiss'))
    expect(screen.queryByText(/queued/i)).toBeNull()
  })
})
