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
