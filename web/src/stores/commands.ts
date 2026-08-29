import { create } from 'zustand'
import { authFetch } from '../lib/api'
import { saveEntity, duplicateEntity } from './utils'
import { commandsResource, commandResource, scopedUrl } from '../lib/resources'

export interface CommandInfo {
  id: string
  name: string
  agentMode?: string
  paramNames?: string[]
}

export interface CommandFull {
  metadata: { id: string; name: string; agentMode?: string }
  prompt: string
}

interface CommandsState {
  createCommand: (
    command: CommandFull,
    destination?: 'project' | 'user',
    workdir?: string,
  ) => Promise<{ success: boolean; error?: string }>
  updateCommand: (
    id: string,
    command: Partial<CommandFull>,
    workdir?: string,
  ) => Promise<{ success: boolean; error?: string }>
  deleteCommand: (commandId: string, workdir?: string) => Promise<{ success: boolean; error?: string; reason?: string }>
  duplicateCommand: (
    commandId: string,
    destination?: 'project' | 'user',
    workdir?: string,
  ) => Promise<{ success: boolean; error?: string }>
}

export const useCommandsStore = create<CommandsState>(() => ({
  createCommand: async (command: CommandFull, destination?: 'project' | 'user', workdir?: string) => {
    const result = await saveEntity('POST', scopedUrl('/api/commands', workdir), {
      ...command,
      destination,
    } as unknown as Record<string, unknown>)
    if (result.success) await commandsResource.refresh(workdir)
    return result
  },

  updateCommand: async (id: string, command: Partial<CommandFull>, workdir?: string) => {
    const result = await saveEntity(
      'PUT',
      scopedUrl(`/api/commands/${id}`, workdir),
      command as unknown as Record<string, unknown>,
    )
    if (result.success) {
      await commandsResource.refresh(workdir)
      commandResource.invalidate(id, workdir)
    }
    return result
  },

  deleteCommand: async (commandId: string, workdir?: string) => {
    try {
      const res = await authFetch(scopedUrl(`/api/commands/${commandId}`, workdir), { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        await commandsResource.refresh(workdir)
        commandResource.invalidate(commandId, workdir)
        return { success: true }
      }
      return { success: false, error: data.error ?? 'Failed to delete' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  },

  duplicateCommand: async (commandId: string, destination?: 'project' | 'user', workdir?: string) => {
    return duplicateEntity(
      scopedUrl(`/api/commands/${commandId}/duplicate`, workdir),
      async () => {
        await commandsResource.refresh(workdir)
      },
      destination,
    )
  },
}))
