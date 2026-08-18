/**
 * Curated reasoning-effort catalog for well-known model families.
 *
 * A static registry mapping model id patterns to the reasoning_effort values
 * they advertise, sourced from official provider docs / model cards (2026-08).
 * Only models that expose a configurable `reasoning_effort` are listed —
 * families with on/off thinking only (e.g. Gemma via `<|think|>`, GLM <= 5.1,
 * Kimi K2.x) intentionally have no entry.
 *
 * This feeds the provider model list and auto-config so the UI can offer the
 * right effort values for known models instead of guessing.
 */

import { REASONING_EFFORT_VALUES, isReasoningEffortValue } from '../../shared/reasoning-effort.js'

export { REASONING_EFFORT_VALUES, isReasoningEffortValue }

export interface ModelCatalogEntry {
  /** Reasoning effort values the model advertises, in display order. */
  reasoningEfforts: string[]
  /** Sensible default effort for the model (used when none is picked). */
  defaultReasoningEffort?: string
}

interface CatalogRule {
  pattern: RegExp
  entry: ModelCatalogEntry
}

const CATALOG: CatalogRule[] = [
  {
    // DeepSeek V4 Flash/Pro: official API accepts low/high/max
    // (medium → high, xhigh → max are compatibility mappings); 'none'
    // disables thinking mode on setups that honor it.
    pattern: /^deepseek-v4-(flash|pro)(\b|-|$)/i,
    entry: { reasoningEfforts: ['none', 'low', 'high', 'max'], defaultReasoningEffort: 'high' },
  },
  {
    // Qwen3.6 / 3.7 / 3.8 families: low/medium/high is the common denominator.
    pattern: /^qwen3\.(6|7|8)(\b|-)/i,
    entry: { reasoningEfforts: ['low', 'medium', 'high'], defaultReasoningEffort: 'medium' },
  },
  {
    // Z.ai GLM-5.3: only max/high/low are accepted.
    pattern: /^glm-5\.3(\b|-)/i,
    entry: { reasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'max' },
  },
  {
    // Z.ai GLM-5.2: full range with compatibility mappings (default max).
    pattern: /^glm-5\.2(\b|-)/i,
    entry: {
      reasoningEfforts: ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'],
      defaultReasoningEffort: 'max',
    },
  },
  {
    // Moonshot Kimi K3: low/high/max (default max).
    pattern: /^kimi-k3(\b|-)/i,
    entry: { reasoningEfforts: ['low', 'high', 'max'], defaultReasoningEffort: 'max' },
  },
  {
    // OpenAI GPT-5.x / o-series reasoning models.
    pattern: /^(gpt-5|o[1-9])(\b|-|$)/i,
    entry: { reasoningEfforts: ['minimal', 'low', 'medium', 'high'], defaultReasoningEffort: 'medium' },
  },
]

export function getCatalogEntry(modelId: string): ModelCatalogEntry | undefined {
  // Match against the full id and its last path segment so org-prefixed ids
  // (e.g. "Qwen/Qwen3.6-27B-FP8") resolve to the same family as bare ids.
  const basename = modelId.split('/').pop() ?? modelId
  for (const rule of CATALOG) {
    if (rule.pattern.test(modelId) || rule.pattern.test(basename)) return rule.entry
  }
  return undefined
}

/** Default reasoning effort for a model id, when known. */
export function getCatalogDefaultEffort(modelId: string): string | undefined {
  return getCatalogEntry(modelId)?.defaultReasoningEffort
}
