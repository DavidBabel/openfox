import { create } from 'zustand'
import { authFetch } from '../lib/api'
import { saveEntity, duplicateEntity } from './utils'

export interface AgentInfo {
  id: string
  name: string
  description: string
  subagent: boolean
  allowedTools: string[]
  color?: string
  results?: string[]
}

export interface AgentFull {
  metadata: {
    id: string
    name: string
    description: string
    subagent: boolean
    allowedTools: string[]
    color?: string
    results?: string[]
  }
  prompt: string
}

const DEFAULT_AGENT_COLOR = '#6b7280'

export function getAgentColor(agents: AgentInfo[], agentId: string): string {
  return agents.find((a) => a.id === agentId)?.color ?? DEFAULT_AGENT_COLOR
}

interface AgentsState {
  defaults: AgentInfo[]
  userItems: AgentInfo[]
  projectItems: AgentInfo[]
  modelOverrides: Record<string, string>
  loading: boolean
  fetchAgents: () => Promise<void>
  fetchAgent: (agentId: string) => Promise<AgentFull | null>
  fetchDefaultContent: (agentId: string) => Promise<AgentFull | null>
  createAgent: (agent: AgentFull, destination?: 'project' | 'user') => Promise<{ success: boolean; error?: string }>
  updateAgent: (id: string, agent: Partial<AgentFull>) => Promise<{ success: boolean; error?: string }>
  deleteAgent: (agentId: string) => Promise<{ success: boolean; error?: string; reason?: string }>
  duplicateAgent: (agentId: string, destination?: 'project' | 'user') => Promise<{ success: boolean; error?: string }>
}

export const useAgentsStore = create<AgentsState>((set) => {
  const fetchAgents = async () => {
    set({ loading: true } as Record<string, unknown>)
    try {
      const res = await authFetch('/api/agents')
      const data = await res.json()
      set({
        defaults: data.defaults ?? [],
        userItems: data.userItems ?? [],
        projectItems: data.projectItems ?? [],
        modelOverrides: data.modelOverrides ?? {},
        loading: false,
      } as Record<string, unknown>)
    } catch {
      set({ loading: false } as Record<string, unknown>)
    }
  }

  return {
    defaults: [],
    userItems: [],
    projectItems: [],
    modelOverrides: {},
    loading: false,

    fetchAgents,

    fetchAgent: async (agentId: string) => {
      try {
        const res = await authFetch(`/api/agents/${agentId}`)
        if (!res.ok) return null
        return (await res.json()) as AgentFull
      } catch {
        return null
      }
    },

    fetchDefaultContent: async (agentId: string) => {
      try {
        const res = await authFetch(`/api/agents/defaults/${agentId}`)
        if (!res.ok) return null
        return (await res.json()) as AgentFull
      } catch {
        return null
      }
    },

    createAgent: async (agent: AgentFull, destination?: 'project' | 'user') => {
      const result = await saveEntity('POST', '/api/agents', {
        ...agent,
        destination,
      } as unknown as Record<string, unknown>)
      if (result.success) await fetchAgents()
      return result
    },

    updateAgent: async (id: string, agent: Partial<AgentFull>) => {
      const result = await saveEntity('PUT', `/api/agents/${id}`, agent as unknown as Record<string, unknown>)
      if (result.success) await fetchAgents()
      return result
    },

    deleteAgent: async (agentId: string) => {
      try {
        const res = await authFetch(`/api/agents/${agentId}`, { method: 'DELETE' })
        const data = await res.json()
        if (res.ok) {
          set((state) => ({
            userItems: state.userItems.filter((a) => a.id !== agentId),
            projectItems: state.projectItems.filter((a) => a.id !== agentId),
          }))
          return { success: true }
        }
        return { success: false, error: data.error ?? 'Failed to delete' }
      } catch {
        return { success: false, error: 'Network error' }
      }
    },

    duplicateAgent: async (agentId: string, destination?: 'project' | 'user') => {
      return duplicateEntity(`/api/agents/${agentId}/duplicate`, fetchAgents, destination)
    },
  }
})
