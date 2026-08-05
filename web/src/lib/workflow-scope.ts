import type { WorkflowScope, WorkflowLaunchScope } from '@shared/types.js'

export const SCOPE_LABELS: Record<WorkflowScope, string> = {
  builtin: 'Built-in',
  user: 'Global',
  project: 'Project',
}

/**
 * Resolve the effective definition for a workflow id from a flat list that may
 * contain the same id in several scopes. Mirrors server precedence:
 * project > user > builtin. Returns undefined when the id is absent.
 */
export function resolveEffectiveWorkflow<T extends { id: string; scope: WorkflowScope }>(
  items: T[],
  id: string,
): T | undefined {
  const candidates = items.filter((w) => w.id === id)
  if (candidates.length === 0) return undefined
  return (
    candidates.find((c) => c.scope === 'project') ??
    candidates.find((c) => c.scope === 'user') ??
    candidates.find((c) => c.scope === 'builtin')
  )
}

/**
 * Resolve the definition a launch will actually execute. When an explicit scope
 * was chosen it must match exactly (falling back to precedence if that bucket no
 * longer has the workflow); 'auto' resolves by server precedence. Use this for
 * any pre-launch decision (param validation, hints) so it agrees with execution.
 */
export function resolveWorkflowForLaunch<T extends { id: string; scope: WorkflowScope }>(
  workflows: T[],
  id: string,
  scope: WorkflowLaunchScope,
): T | undefined {
  if (scope !== 'auto') {
    return workflows.find((w) => w.id === id && w.scope === scope) ?? resolveEffectiveWorkflow(workflows, id)
  }
  return resolveEffectiveWorkflow(workflows, id)
}
