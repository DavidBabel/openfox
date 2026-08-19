import { authFetch } from './api'
import { resource, snapshot } from './resourceCache'
import type { AgentInfo } from '../stores/agents'

export interface AgentsData {
  defaults: AgentInfo[]
  userItems: AgentInfo[]
  projectItems: AgentInfo[]
  modelOverrides: Record<string, string>
}

export const agentsUrl = (path: string, workdir?: string): string =>
  workdir ? `${path}?workdir=${encodeURIComponent(workdir)}` : path

export async function fetchAgents(workdir?: string): Promise<AgentsData> {
  const res = await authFetch(agentsUrl('/api/agents', workdir))
  if (!res.ok) throw new Error(`Failed to load agents (${res.status})`)
  const data = (await res.json()) as Partial<AgentsData>
  return {
    defaults: data.defaults ?? [],
    userItems: data.userItems ?? [],
    projectItems: data.projectItems ?? [],
    modelOverrides: data.modelOverrides ?? {},
  }
}

export const agentsResource = resource<AgentsData, [string?]>({
  key: (workdir) => `agents:${workdir ?? ''}`,
  fetch: fetchAgents,
  maxAgeMs: 60_000,
})

/** Synchronous cache read for non-hook call sites (event handlers, getState-style reads). */
export function readAgents(workdir?: string): AgentsData | undefined {
  return snapshot<AgentsData>(agentsResource.keyOf(workdir)).data
}
