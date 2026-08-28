/**
 * LLM Backend capabilities and display names.
 * Supports vLLM, SGLang, Ollama, and llama.cpp inference engines.
 */

export type Backend =
  'vllm' | 'sglang' | 'ollama' | 'llamacpp' | 'lmstudio' | 'opencode-go' | 'openai' | 'anthropic' | 'unknown'

export interface BackendCapabilities {
  /** Whether chat_template_kwargs with enable_thinking works (vLLM/SGLang) */
  supportsChatTemplateKwargs: boolean
  /** Whether top_k parameter is supported in OpenAI-compatible mode */
  supportsTopK: boolean
  /** Whether the client uses Ollama's native /api/chat (consumes num_ctx) */
  supportsNumCtx: boolean
  /**
   * Whether reasoning effort must be routed through chat_template_kwargs
   * (llama.cpp only populates Jinja template variables from kwargs; a
   * top-level reasoning_effort body field is silently ignored).
   */
  routesEffortViaChatTemplateKwargs: boolean
  /**
   * Whether the backend expects max_completion_tokens instead of max_tokens
   * (OpenAI's newer models reject max_tokens outright).
   */
  usesMaxCompletionTokens: boolean
}

const BACKEND_CAPABILITIES: Record<Backend, BackendCapabilities> = {
  vllm: {
    supportsChatTemplateKwargs: true,
    supportsTopK: true,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: false,
  },
  sglang: {
    supportsChatTemplateKwargs: true,
    supportsTopK: true,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: false,
  },
  openai: {
    supportsChatTemplateKwargs: false,
    supportsTopK: false,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: true,
  },
  anthropic: {
    supportsChatTemplateKwargs: false,
    supportsTopK: false,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: false,
  },
  ollama: {
    supportsChatTemplateKwargs: false,
    supportsTopK: false,
    supportsNumCtx: true,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: false,
  },
  llamacpp: {
    supportsChatTemplateKwargs: false,
    supportsTopK: true,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: true,
    usesMaxCompletionTokens: false,
  },
  lmstudio: {
    supportsChatTemplateKwargs: false,
    supportsTopK: true,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: false,
  },
  'opencode-go': {
    supportsChatTemplateKwargs: false,
    supportsTopK: true,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: false,
  },
  unknown: {
    supportsChatTemplateKwargs: true,
    supportsTopK: true,
    supportsNumCtx: false,
    routesEffortViaChatTemplateKwargs: false,
    usesMaxCompletionTokens: false,
  },
}

export function getBackendCapabilities(backend: Backend): BackendCapabilities {
  return BACKEND_CAPABILITIES[backend]
}

/**
 * Well-known hosted API hosts and the backend they speak. Used to rescue
 * providers saved with an "unknown" backend (e.g. a preset that did not set
 * one) so the correct capabilities apply at request time.
 */
const HOST_BACKEND_MAP: Record<string, Backend> = {
  'api.openai.com': 'openai',
  'api.anthropic.com': 'anthropic',
}

/**
 * Detect the backend from a provider URL host, or undefined when the host is
 * not a known hosted API.
 */
export function detectBackendFromUrl(url: string): Backend | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return HOST_BACKEND_MAP[host]
  } catch {
    return undefined
  }
}

/** Display name for each backend */
export function getBackendDisplayName(backend: Backend): string {
  switch (backend) {
    case 'vllm':
      return 'vLLM'
    case 'sglang':
      return 'SGLang'
    case 'ollama':
      return 'Ollama'
    case 'llamacpp':
      return 'llama.cpp'
    case 'lmstudio':
      return 'LM Studio'
    case 'opencode-go':
      return 'OpenCode Go'
    case 'openai':
      return 'OpenAI'
    case 'anthropic':
      return 'Anthropic'
    case 'unknown':
      return 'Other'
  }
}
