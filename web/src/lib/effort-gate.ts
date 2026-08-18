/**
 * Reasoning-effort change gating.
 *
 * Switching the reasoning effort mid-session invalidates the LLM server's prefix
 * cache (the server templates `reasoning_effort` into the system prompt). To keep
 * the cache sacred, effort-changing transitions are gated behind an explicit
 * choice when a warm cache exists.
 */

export interface EffortGateSession {
  providerReasoningEffort?: string | null
  providerPinnedEffort?: string | null
  providerManual?: boolean
  providerManualActive?: boolean
}

export interface ResolveEffectiveEffortOptions {
  session?: EffortGateSession | null
  /** Effort from the current agent's model override. */
  agentOverrideEffort?: string | undefined
  /** Model's configured default effort (thinkingLevel). */
  modelDefaultEffort?: string | undefined
}

/**
 * The reasoning effort that would currently be SENT for the session, mirroring
 * the server's resolution: manual pick > pinned effort > agent override >
 * session-stored effort > model default.
 *
 * An ACTIVE manual pick is authoritative: the server returns only its stored
 * effort (empty → the model's default effort applies), never the pin or an
 * agent override.
 */
export function resolveEffectiveEffort({
  session,
  agentOverrideEffort,
  modelDefaultEffort,
}: ResolveEffectiveEffortOptions): string | undefined {
  const isManual = !!session?.providerManual && !!session?.providerManualActive
  if (isManual) return session?.providerReasoningEffort ?? modelDefaultEffort
  const explicit = session?.providerPinnedEffort ?? agentOverrideEffort ?? session?.providerReasoningEffort ?? undefined
  return explicit ?? modelDefaultEffort
}

/**
 * Whether switching to `proposedEffort` should be gated: only when there is a
 * warm prefix cache AND a concrete current effort to preserve AND the proposed
 * effort genuinely differs from it. Fresh sessions, no-op picks, and cases with
 * no current effort (nothing for "Keep" to pin) apply immediately.
 */
export function shouldGateEffortChange(opts: {
  warmCache?: boolean
  currentEffort?: string
  proposedEffort?: string
}): boolean {
  const { warmCache, currentEffort, proposedEffort } = opts
  return !!warmCache && !!proposedEffort && !!currentEffort && proposedEffort !== currentEffort
}

export interface WorkflowStepLike {
  id: string
  type: string
  agentId?: string
  subAgentType?: string
  subGroup?: string
}

/**
 * The agent a workflow launch will run first: the entry step (or the first
 * step of the launched sub-group slice, mirroring the server executor). Agent
 * and sub_agent steps have an agent identity whose model override may carry a
 * reasoning effort; shell and user steps do not.
 */
export function resolveWorkflowFirstAgentId(
  workflow: { entryStep: string; steps: WorkflowStepLike[] },
  subGroup?: string,
): string | undefined {
  const steps = subGroup ? workflow.steps.filter((s) => s.subGroup === subGroup) : workflow.steps
  const firstId = subGroup ? (steps[0]?.id ?? workflow.entryStep) : workflow.entryStep
  const step = workflow.steps.find((s) => s.id === firstId)
  if (!step) return undefined
  if (step.type === 'agent') return step.agentId
  if (step.type === 'sub_agent') return step.subAgentType
  return undefined
}
