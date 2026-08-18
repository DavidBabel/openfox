import { useCallback } from 'react'
import { useSessionScope, useScopedPaneState } from '../stores/session/session-scope'
import { useSessionStore } from '../stores/session'
import { useConfigStore } from '../stores/config'
import { useAgentsStore } from '../stores/agents'
import { useEffortChangeGate } from '../components/plan/EffortChangeGate'
import { resolveEffectiveEffort, shouldGateEffortChange } from '../lib/effort-gate'
import { parseModelValue } from '../lib/model-value'

/**
 * Current reasoning-effort context for a session: the effort that would be sent
 * right now (pin-aware), whether the LLM prefix cache is warm, and the gate to
 * request an explicit effort-switch choice.
 *
 * Pass an explicit `sessionId` when the caller is not inside a SessionScopeProvider
 * (e.g. hook consumers at the panel level); otherwise the scoped session is used.
 */
export function useEffortGateContext(explicitSessionId?: string | null | undefined) {
  const scopedSessionId = useSessionScope()
  const sessionId = explicitSessionId ?? scopedSessionId
  const currentSession = useScopedPaneState(
    sessionId,
    (pane) => pane.session ?? null,
    (state) => state.currentSession,
    null,
  )
  const contextState = useScopedPaneState(
    sessionId,
    (pane) => pane.contextState ?? null,
    (state) => state.contextState,
    null,
  )
  const gate = useEffortChangeGate()

  const providers = useConfigStore((s) => s.providers)
  const defaultModelSelection = useConfigStore((s) => s.defaultModelSelection)
  const modelOverrides = useAgentsStore((s) => s.modelOverrides)

  // Current agent's override effort and model (the agent currently active in
  // the session). The override's MODEL is the source of the model-default
  // effort fallback, mirroring the server: an override without an explicit
  // effort still resolves to its own model's thinkingLevel, not the session's.
  const currentAgentId = currentSession?.mode
  const agentOverride = currentAgentId ? (modelOverrides[currentAgentId] ?? undefined) : undefined
  const agentOverrideParsed = agentOverride ? parseModelValue(agentOverride) : undefined
  const agentOverrideEffort = agentOverrideParsed?.reasoningEffort

  const isSessionManual = !!currentSession?.providerManual && !!currentSession?.providerManualActive
  const sessionProviderId = currentSession?.providerId ?? null
  const sessionModel = currentSession?.providerModel ?? null
  const defaultProviderId = defaultModelSelection?.split('/')[0] ?? null
  const defaultModel = defaultModelSelection?.split('/').slice(1).join('/') ?? null
  // Same precedence as the server and the selector label: manual pick wins
  // while active, otherwise agent override > session preference > default.
  const effectiveProviderId = isSessionManual
    ? sessionProviderId
    : (agentOverrideParsed?.providerId ?? sessionProviderId ?? defaultProviderId)
  const effectiveModel = isSessionManual ? sessionModel : (agentOverrideParsed?.model ?? sessionModel ?? defaultModel)
  const effectiveModelConfig = effectiveProviderId
    ? providers.find((p) => p.id === effectiveProviderId)?.models.find((m) => m.id === effectiveModel)
    : undefined
  const modelDefaultEffort =
    effectiveModelConfig?.reasoningEffortOverride ??
    (effectiveModelConfig?.thinkingEnabled ? effectiveModelConfig.thinkingLevel : undefined)

  const currentEffort = resolveEffectiveEffort({
    session: currentSession,
    agentOverrideEffort,
    modelDefaultEffort,
  })

  return {
    sessionId,
    currentEffort,
    warmCache: contextState?.warmCache,
    gate,
  }
}

/**
 * A gate-aware agent switch shared by every agent-selection entry point (the
 * dropdown and the keyboard shortcuts): switching to an agent whose override
 * carries a differing reasoning effort on a warm cache opens the gate; Apply
 * clears the pin (override effort takes effect), Keep pins the current effort.
 */
export function useEffortGatedAgentSwitch(
  explicitSessionId?: string | null | undefined,
): (agentId: string, agentName?: string) => Promise<void> {
  const { sessionId, currentEffort, warmCache, gate } = useEffortGateContext(explicitSessionId)
  const switchMode = useSessionStore((state) => state.switchMode)
  const pinSessionEffort = useSessionStore((state) => state.pinSessionEffort)
  const clearSessionEffortPin = useSessionStore((state) => state.clearSessionEffortPin)
  const modelOverrides = useAgentsStore((state) => state.modelOverrides)

  return useCallback(
    async (agentId: string, agentName?: string) => {
      if (!sessionId) return
      const overrideEffort = parseModelValue(modelOverrides[agentId])?.reasoningEffort
      if (
        overrideEffort &&
        shouldGateEffortChange({
          warmCache,
          currentEffort,
          proposedEffort: overrideEffort,
        })
      ) {
        const choice = await gate.requestEffortSwitch({
          fromEffort: currentEffort,
          toEffort: overrideEffort,
          contextLabel: agentName,
        })
        if (choice === 'keep') {
          if (currentEffort) await pinSessionEffort(sessionId, currentEffort)
        } else {
          await clearSessionEffortPin(sessionId)
        }
      }
      await switchMode(sessionId, agentId)
    },
    [sessionId, warmCache, currentEffort, gate, switchMode, pinSessionEffort, clearSessionEffortPin, modelOverrides],
  )
}
