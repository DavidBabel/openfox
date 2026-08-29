import { create } from 'zustand'
import { authFetch } from '../lib/api'
import { saveEntity, duplicateEntity } from './utils'
import { workflowsResource, workflowResource } from '../lib/resources'
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

export const useWorkflowsStore = create<WorkflowsState>(() => ({
  createWorkflow: async (workflow: WorkflowFull, destination?: 'project' | 'user', workdir?: string) => {
    const result = await saveEntity('POST', `/api/workflows${workdirQuery(workdir)}`, {
      ...workflow,
      destination,
    } as unknown as Record<string, unknown>)
    if (result.success) await workflowsResource.refresh(workdir)
    return result
  },

  updateWorkflow: async (id: string, workflow: Partial<WorkflowFull>, workdir?: string, scope?: WorkflowScope) => {
    const result = await saveEntity(
      'PUT',
      `/api/workflows/${id}${workdirQuery(workdir)}${scopeQuery(scope)}`,
      workflow as unknown as Record<string, unknown>,
    )
    if (result.success) {
      await workflowsResource.refresh(workdir)
      workflowResource.invalidate(id, workdir, scope)
    }
    return result
  },

  deleteWorkflow: async (id: string, scope: WorkflowScope, workdir?: string) => {
    try {
      const res = await authFetch(`/api/workflows/${id}${workdirQuery(workdir)}${scopeQuery(scope)}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (res.ok) {
        await workflowsResource.refresh(workdir)
        workflowResource.invalidate(id, workdir, scope)
        return { success: true }
      }
      return { success: false, error: data.error ?? 'Failed to delete' }
    } catch {
      return { success: false, error: 'Network error' }
    }
  },

  duplicateWorkflow: async (id: string, destination?: 'project' | 'user', workdir?: string) => {
    return duplicateEntity(
      `/api/workflows/${id}/duplicate${workdirQuery(workdir)}`,
      async () => {
        await workflowsResource.refresh(workdir)
      },
      destination,
    )
  },
}))
