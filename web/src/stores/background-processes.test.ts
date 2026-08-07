// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useBackgroundProcessesStore } from './background-processes'

vi.mock('../lib/api', () => ({
  authFetch: vi.fn(),
}))

describe('useBackgroundProcessesStore', () => {
  beforeEach(() => {
    useBackgroundProcessesStore.setState({ processes: [], logs: {} })
  })

  describe('handleMessage backgroundProcess.started', () => {
    it('registers the process with its launch command and working directory', () => {
      useBackgroundProcessesStore.getState().handleMessage('backgroundProcess.started', {
        processId: 'proc-1',
        name: 'dev-server',
        command: 'npm run dev',
        cwd: '/project',
        pid: 4321,
        status: 'running',
      })

      const processes = useBackgroundProcessesStore.getState().processes
      expect(processes).toHaveLength(1)
      expect(processes[0]).toMatchObject({
        id: 'proc-1',
        name: 'dev-server',
        command: 'npm run dev',
        cwd: '/project',
        pid: 4321,
        status: 'running',
      })
    })
  })
})
