/**
 * Canonical reasoning_effort vocabulary understood across providers.
 *
 * Single source of truth shared by the server (validation, model catalog,
 * auto-config) and the web client (pickers, `provider/model:effort` parsing).
 * Keep this list in sync with what providers actually advertise — see
 * `src/server/providers/model-catalog.ts` for per-family values.
 */

export const REASONING_EFFORT_VALUES = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

export type ReasoningEffortValue = (typeof REASONING_EFFORT_VALUES)[number]

export function isReasoningEffortValue(value: string): boolean {
  return (REASONING_EFFORT_VALUES as readonly string[]).includes(value)
}

export interface ResolveEffortForModelOptions {
  /** The model's advertised preset list (UI chips). Absent/empty = no constraint. */
  reasoningEfforts?: string[]
  /** An explicit effort (session pick, pin, or agent override). */
  candidate?: string
  /** The model's configured default (thinkingLevel-based), clamped to the list. */
  defaultEffort?: string
  /** The model's raw reasoning-effort override — sent verbatim, never clamped. */
  override?: string
}

/**
 * Resolve the reasoning effort to actually send for a model, honoring the
 * model's advertised preset list.
 *
 * - An explicit `none` is always honored verbatim — the universal "thinking
 *   off" switch must never be silently turned into a level.
 * - An explicit candidate beats the model defaults: in-list candidates pass
 *   through; out-of-list candidates fall back to the override (escape hatch),
 *   else the advertised default, else the first advertised value.
 * - Without an explicit effort the model default applies: the override verbatim
 *   (never clamped), else `defaultEffort` only when the model advertises it.
 * - Without a list nothing is constrained — candidate, override, and default
 *   pass through as-is.
 */
export function resolveEffortForModel({
  reasoningEfforts,
  candidate,
  defaultEffort,
  override,
}: ResolveEffortForModelOptions): string | undefined {
  if (candidate === 'none') return 'none'
  if (!reasoningEfforts || reasoningEfforts.length === 0) {
    return candidate ?? override ?? defaultEffort
  }
  if (candidate) {
    if (reasoningEfforts.includes(candidate)) return candidate
    if (override) return override
    if (defaultEffort && reasoningEfforts.includes(defaultEffort)) return defaultEffort
    return reasoningEfforts[0]
  }
  if (override) return override
  return defaultEffort && reasoningEfforts.includes(defaultEffort) ? defaultEffort : undefined
}
