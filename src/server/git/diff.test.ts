import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getGitDiffFiles } from './diff.js'

vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('./env.js', () => ({
  gitSpawnEnv: () => ({}),
}))

import { spawn } from 'node:child_process'

type MockProc = {
  stdout: { on: (event: string, cb: (d: Buffer) => void) => void }
  stderr: { on: (event: string, cb: (d: Buffer) => void) => void }
  on: (event: string, cb: (...args: unknown[]) => void) => void
}

function makeMockProc(stdout: string, exitCode = 0): MockProc {
  return {
    stdout: {
      on: (event, cb) => {
        if (event === 'data') setTimeout(() => cb(Buffer.from(stdout)), 0)
      },
    },
    stderr: {
      on: () => {},
    },
    on: (event, cb) => {
      if (event === 'close') setTimeout(() => cb(exitCode), 0)
    },
  }
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('getGitDiffFiles', () => {
  it('passes --ignore-submodules=none to both git invocations', async () => {
    vi.mocked(spawn).mockReturnValue(makeMockProc('') as unknown as ReturnType<typeof spawn>)
    await getGitDiffFiles('/tmp/project')

    const calls = vi.mocked(spawn).mock.calls
    expect(calls.length).toBe(2)
    for (const call of calls) {
      const args = call[1] as string[]
      expect(args).toContain('--ignore-submodules=none')
    }
  })

  it('reports a modified submodule from git diff --name-status output', async () => {
    vi.mocked(spawn).mockImplementation(((_cmd: string, args: string[]) => {
      const stdout = args[0] === 'diff' ? 'M\tlibs/mod\n' : '?? untracked.txt\n'
      return makeMockProc(stdout) as unknown as ReturnType<typeof spawn>
    }) as typeof spawn)

    const files = await getGitDiffFiles('/tmp/project')

    expect(files).toContainEqual({ path: 'libs/mod', status: 'modified', additions: 0, deletions: 0 })
    expect(files).toContainEqual({ path: 'untracked.txt', status: 'added', additions: 0, deletions: 0 })
  })
})
