// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authFetch } from '../lib/api'
import { clearCache, snapshot } from '../lib/resourceCache'
import { commandResource, commandsResource } from '../lib/resources'
import { useCommandsStore, type CommandFull } from './commands'

vi.mock('../lib/api', () => ({
  authFetch: vi.fn(),
}))

const mockedAuthFetch = vi.mocked(authFetch)

const commandFull: CommandFull = {
  metadata: { id: 'custom-review', name: 'Review' },
  prompt: 'Review the proposed changes.',
}

function jsonResponse(data: unknown = {}): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
  } as Response
}

describe('CommandsStore mutations', () => {
  beforeEach(() => {
    mockedAuthFetch.mockReset()
    clearCache()
    mockedAuthFetch.mockResolvedValue(jsonResponse())
  })

  it('sends the project workdir when creating a command and refreshes the list resource', async () => {
    await useCommandsStore.getState().createCommand(commandFull, 'project', '/projects/client app')

    expect(mockedAuthFetch).toHaveBeenNthCalledWith(
      1,
      '/api/commands?workdir=%2Fprojects%2Fclient%20app',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(mockedAuthFetch).toHaveBeenNthCalledWith(2, '/api/commands?workdir=%2Fprojects%2Fclient%20app')
  })

  it('sends the project workdir when updating a command and refreshes + invalidates the resources', async () => {
    await useCommandsStore.getState().updateCommand(commandFull.metadata.id, commandFull, 'C:\\projects\\client')

    expect(mockedAuthFetch).toHaveBeenNthCalledWith(
      1,
      '/api/commands/custom-review?workdir=C%3A%5Cprojects%5Cclient',
      expect.objectContaining({ method: 'PUT' }),
    )
    expect(mockedAuthFetch).toHaveBeenNthCalledWith(2, '/api/commands?workdir=C%3A%5Cprojects%5Cclient')
    expect(snapshot(commandResource.keyOf('custom-review', 'C:\\projects\\client')).data).toBeUndefined()
  })

  it('keeps global requests unchanged when no project workdir is available', async () => {
    await useCommandsStore.getState().createCommand(commandFull, 'user')

    expect(mockedAuthFetch).toHaveBeenNthCalledWith(1, '/api/commands', expect.objectContaining({ method: 'POST' }))
    expect(mockedAuthFetch).toHaveBeenNthCalledWith(2, '/api/commands')
  })

  it('deletes a command then refreshes the scoped list resource', async () => {
    const result = await useCommandsStore.getState().deleteCommand('custom-review', '/repo/a')

    expect(result).toEqual({ success: true })
    expect(mockedAuthFetch).toHaveBeenNthCalledWith(
      1,
      '/api/commands/custom-review?workdir=%2Frepo%2Fa',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(mockedAuthFetch).toHaveBeenNthCalledWith(2, '/api/commands?workdir=%2Frepo%2Fa')
  })

  it('duplicates a command to the project scope and refreshes the list', async () => {
    mockedAuthFetch.mockResolvedValue(jsonResponse({}))
    await useCommandsStore.getState().duplicateCommand('custom-review', 'project', '/repo/a')

    expect(mockedAuthFetch).toHaveBeenNthCalledWith(
      1,
      '/api/commands/custom-review/duplicate?workdir=%2Frepo%2Fa',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ destination: 'project' }) }),
    )
    expect(mockedAuthFetch).toHaveBeenLastCalledWith('/api/commands?workdir=%2Frepo%2Fa')
    expect(commandsResource.keyOf('/repo/a')).toBe('commands:/repo/a')
  })
})
