import { create } from 'zustand'
import { authFetch } from '../lib/api'
import { saveEntity, duplicateEntity } from './utils'
import type { WorkflowParameter, WorkflowScope } from '@shared/types.js'

export type { WorkflowParameter }
export type { WorkflowScope }

export interface WorkflowCondition {
  type: string
  result?: string
  key?: string
  field?: string
  value?: string
  values?: string[]
}

export interface WorkflowInfo {
  id: string
  name: string
  description: string
  version: string
  color?: string
  startCondition?: WorkflowCondition
  subGroups?: string[]
  parameters?: WorkflowParameter[]
  /** Which scope this definition lives in (server-annotated). */
  scope: WorkflowScope
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'agent' | 'sub_agent' | 'shell' | 'user'
  phase: string
  transitions: Array<{ when: WorkflowCondition; goto: string; subGroup?: string }>
  agentId?: string
  subAgentType?: string
  prompt?: string
  nudgePrompt?: string
  command?: string
  timeout?: number
  successExitCodes?: number[]
  subGroup?: string
}

export interface WorkflowFull {
  metadata: {
    id: string
    name: string
    description: string
    version: string
    color?: string
    parameters?: WorkflowParameter[]
  }
  entryStep: string
  settings: { maxIterations: number }
  steps: WorkflowStep[]
  startCondition?: WorkflowCondition
}

export interface TemplateVariable {
  name: string
  description: string
}

interface WorkflowsState {
  defaults: WorkflowInfo[]
  userItems: WorkflowInfo[]
  projectItems: WorkflowInfo[]
  activeWorkflowId: string
  loading: boolean
  templateVariables: TemplateVariable[]
  /** Project root workdir to scope project workflows (ambient default, syncs from the active session). */
  workdir?: string
  setWorkdir: (workdir?: string) => void
  fetchWorkflows: (workdir?: string) => Promise<void>
  fetchTemplateVariables: () => Promise<void>
  fetchWorkflow: (id: string, workdir?: string, scope?: WorkflowScope) => Promise<WorkflowFull | null>
  fetchDefaultContent: (id: string, workdir?: string) => Promise<WorkflowFull | null>
  createWorkflow: (
    workflow: WorkflowFull,
    destination?: 'project' | 'user',
    workdir?: string,
  ) => Promise<{ success: boolean; error?: string }>
  updateWorkflow: (
    id: string,
    workflow: Partial<WorkflowFull>,
    workdir?: string,
    scope?: WorkflowScope,
  ) => Promise<{ success: boolean; error?: string }>
  deleteWorkflow: (
    id: string,
    scope: WorkflowScope,
    workdir?: string,
  ) => Promise<{ success: boolean; error?: string; reason?: string }>
  duplicateWorkflow: (
    id: string,
    destination?: 'project' | 'user',
    workdir?: string,
  ) => Promise<{ success: boolean; error?: string }>
}

const workdirQuery = (workdir: string | undefined): string => (workdir ? `?workdir=${encodeURIComponent(workdir)}` : '')

const scopeQuery = (scope: WorkflowScope | undefined): string => (scope ? `&scope=${scope}` : '')

/** Flat list of every workflow across scopes, preserving all scope variants. */
export const selectAllWorkflows = (state: WorkflowsState): WorkflowInfo[] => [
  ...state.defaults,
  ...state.userItems,
  ...state.projectItems,
]

export const useWorkflowsStore = create<WorkflowsState>((set, get) => ({
  defaults: [],
  userItems: [],
  projectItems: [],
  activeWorkflowId: 'default',
  loading: false,
  templateVariables: [],

  setWorkdir: (workdir) => set({ workdir }),

  fetchTemplateVariables: async () => {
    try {
      const res = await authFetch('/api/workflows/template-variables')
      const data = await res.json()
      set({ templateVariables: data.variables ?? [] })
    } catch {
      /* ignore */
    }
  },

  fetchWorkflows: async (workdir) => {
    set({ loading: true })
    try {
      const res = await authFetch(`/api/workflows${workdirQuery(workdir ?? get().workdir)}`)
      const data = await res.json()
      set({
        defaults: data.defaults ?? [],
        userItems: data.userItems ?? [],
        projectItems: data.projectItems ?? [],
        activeWorkflowId: data.activeWorkflowId ?? 'default',
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  fetchWorkflow: async (id: string, workdir, scope) => {
    try {
      const res = await authFetch(`/api/workflows/${id}${workdirQuery(workdir ?? get().workdir)}${scopeQuery(scope)}`)
      if (!res.ok) return null
      return (await res.json()) as WorkflowFull
    } catch {
      return null
    }
  },

  fetchDefaultContent: async (id: string, workdir) => {
    try {
      const res = await authFetch(`/api/workflows/defaults/${id}${workdirQuery(workdir ?? get().workdir)}`)
      if (!res.ok) return null
      return (await res.json()) as WorkflowFull
    } catch {
      return null
    }
  },

  createWorkflow: async (workflow: WorkflowFull, destination, workdir) => {
    const wd = workdir ?? get().workdir
    const result = await saveEntity('POST', `/api/workflows${workdirQuery(wd)}`, {
      ...workflow,
      destination,
    } as unknown as Record<string, unknown>)
    if (result.success) await get().fetchWorkflows(wd)
    return result
  },

  updateWorkflow: async (id: string, workflow: Partial<WorkflowFull>, workdir, scope) => {
    const wd = workdir ?? get().workdir
    const result = await saveEntity(
      'PUT',
      `/api/workflows/${id}${workdirQuery(wd)}${scopeQuery(scope)}`,
      workflow as unknown as Record<string, unknown>,
    )
    if (result.success) await get().fetchWorkflows(wd)
    return result
  },

  deleteWorkflow: async (id: string, scope, workdir) => {
    try {
      const res = await authFetch(`/api/workflows/${id}${workdirQuery(workdir ?? get().workdir)}${scopeQuery(scope)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        set((state) => ({
          ...(scope === 'user' ? { userItems: state.userItems.filter((p) => p.id !== id) } : {}),
          ...(scope === 'project' ? { projectItems: state.projectItems.filter((p) => p.id !== id) } : {}),
        }))
        return { success: true }
      }
      return { success: false, error: data.error ?? 'Failed to delete' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  },

  duplicateWorkflow: async (id: string, destination, workdir) => {
    const wd = workdir ?? get().workdir
    return duplicateEntity(
      `/api/workflows/${id}/duplicate${workdirQuery(wd)}`,
      () => get().fetchWorkflows(wd),
      destination,
    )
  },
}))
