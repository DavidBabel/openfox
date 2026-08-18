export interface TurnStats {
  model: string
  /** Reasoning effort applied for this turn (e.g. "high"). */
  reasoningEffort?: string
  mode: string
  totalTime: number
  prefillTokens: number
  generationTokens: number
  llmCalls?: Array<{
    temperature?: number
    topP?: number
    topK?: number
    maxTokens?: number
    promptTokens: number
    completionTokens: number
    ttft: number
    completionTime: number
  }>
}
