/**
 * Agent Model Overrides
 *
 * Per-user overrides mapping an agent id to a specific provider + model.
 * Stored in DB settings as JSON under `agent.modelOverrides`.
 * Absence of an override = agent uses the session/global model.
 */

import { z } from 'zod'
import { getSetting, setSetting, SETTINGS_KEYS } from '../db/settings.js'
import type { LLMClientWithModel } from '../llm/client.js'
import type { ProviderManager } from '../provider-manager.js'

export const AGENT_MODEL_OVERRIDES_KEY = SETTINGS_KEYS.AGENT_MODEL_OVERRIDES

const overrideSchema = z.object({
  providerId: z.string().min(1),
  model: z.string().min(1),
  reasoningEffort: z.string().min(1).optional(),
})

export type AgentModelOverride = z.infer<typeof overrideSchema>
export type AgentModelOverrides = Record<string, AgentModelOverride>

export function parseAgentModelOverrides(raw: string | null | undefined): AgentModelOverrides {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}

  const result: AgentModelOverrides = {}
  for (const [agentId, value] of Object.entries(parsed)) {
    const validated = overrideSchema.safeParse(value)
    if (validated.success) {
      result[agentId] = validated.data
    }
  }
  return result
}

export function getAgentModelOverrides(): AgentModelOverrides {
  return parseAgentModelOverrides(getSetting(AGENT_MODEL_OVERRIDES_KEY))
}

export function getAgentModelOverride(agentId: string): AgentModelOverride | undefined {
  return getAgentModelOverrides()[agentId]
}

export function setAgentModelOverride(agentId: string, override: AgentModelOverride | null): void {
  const overrides = getAgentModelOverrides()
  if (override === null) {
    delete overrides[agentId]
  } else {
    overrides[agentId] = override
  }
  setSetting(AGENT_MODEL_OVERRIDES_KEY, JSON.stringify(overrides))
}

export interface AgentClientResolution {
  client: LLMClientWithModel
  usedOverride: boolean
  override?: AgentModelOverride
  warning?: string
}

/**
 * Resolve the LLM client for an agent. When the agent has an override and the
 * provider/model still exists, returns a dedicated client. Otherwise returns
 * the fallback (session/global) client, with a warning when an override was
 * configured but could not be resolved.
 */
export function resolveLLMClientForAgent(
  agentId: string,
  fallbackClient: LLMClientWithModel,
  providerManager: ProviderManager,
): AgentClientResolution {
  const override = getAgentModelOverride(agentId)
  if (!override) {
    return { client: fallbackClient, usedOverride: false }
  }

  const client = providerManager.createClient(override.providerId, override.model, override.reasoningEffort)
  if (!client) {
    return {
      client: fallbackClient,
      usedOverride: false,
      override,
      warning: `Agent '${agentId}' is configured to use model '${override.model}' from provider '${override.providerId}', but it is no longer available. Falling back to the session model.`,
    }
  }

  return { client, usedOverride: true, override }
}
