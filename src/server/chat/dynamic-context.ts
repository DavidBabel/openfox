import { createHash, randomUUID } from 'node:crypto'
import type { SkillMetadata } from '../skills/types.js'
import type { LLMToolDefinition } from '../llm/types.js'
import type { SessionManager } from '../session/manager.js'
import type { AgentDefinition } from '../agents/types.js'
import type { TurnEvent } from '../events/types.js'
import { getCurrentContextWindowId, getEventStore } from '../events/index.js'
import { getAllInstructions } from '../context/instructions.js'
import { getEnabledSkillMetadata } from '../skills/registry.js'
import { buildTopLevelSystemPrompt } from './prompts.js'
import { loadAllAgentsDefault, getSubAgents, findAgentById, resolveDefaultAgentId } from '../agents/registry.js'
import { getRuntimeConfig } from '../runtime-config.js'
import { getGlobalConfigDir } from '../../cli/paths.js'
import { logger } from '../utils/logger.js'

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed'
  content: string
}

/**
 * Compute unified diff between two texts.
 * Returns array of diff lines with type markers.
 */
export function computeUnifiedDiff(oldText: string, newText: string): DiffLine[] {
  // Handle empty strings - split by newline but filter out trailing empty string
  const oldLines = oldText.length === 0 ? [] : oldText.split('\n')
  const newLines = newText.length === 0 ? [] : newText.split('\n')
  const result: DiffLine[] = []

  // Quick check: if texts are identical, return all unchanged
  if (oldText === newText) {
    return oldLines.map((line) => ({ type: 'unchanged' as const, content: line }))
  }

  // Build LCS table using Map to avoid TypeScript indexing issues
  const lcs = new Map<number, Map<number, number>>()
  for (let i = 0; i <= oldLines.length; i++) {
    lcs.set(i, new Map())
    for (let j = 0; j <= newLines.length; j++) {
      lcs.get(i)!.set(j, 0)
    }
  }

  for (let i = 1; i <= oldLines.length; i++) {
    for (let j = 1; j <= newLines.length; j++) {
      const oldLine = oldLines[i - 1]
      const newLine = newLines[j - 1]
      if (oldLine === newLine) {
        lcs.get(i)!.set(j, (lcs.get(i - 1)!.get(j - 1) ?? 0) + 1)
      } else {
        const up = lcs.get(i - 1)!.get(j) ?? 0
        const left = lcs.get(i)!.get(j - 1) ?? 0
        lcs.get(i)!.set(j, Math.max(up, left))
      }
    }
  }

  // Backtrack to find diff
  let i = oldLines.length
  let j = newLines.length

  while (i > 0 || j > 0) {
    const oldLine = oldLines[i - 1] ?? ''
    const newLine = newLines[j - 1] ?? ''

    if (i > 0 && j > 0 && oldLine === newLine) {
      result.unshift({ type: 'unchanged', content: oldLine })
      i--
      j--
    } else if (i > 0 && j > 0) {
      const lcsIM1J = lcs.get(i - 1)?.get(j) ?? 0
      const lcsIJM1 = lcs.get(i)?.get(j - 1) ?? 0

      // Prefer removing old lines first, then adding new lines
      if (lcsIM1J > lcsIJM1) {
        result.unshift({ type: 'removed', content: oldLine })
        i--
      } else {
        result.unshift({ type: 'added', content: newLine })
        j--
      }
    } else if (i > 0) {
      result.unshift({ type: 'removed', content: oldLine })
      i--
    } else {
      result.unshift({ type: 'added', content: newLine })
      j--
    }
  }

  return result
}

export function computeDynamicContextHash(
  instructionContent: string,
  skills: SkillMetadata[],
  toolFingerprint?: string,
  modelName?: string,
): string {
  const dynamicInputs = JSON.stringify({
    instructions: instructionContent,
    skills: skills.map((s) => s.id).sort(),
    ...(toolFingerprint ? { tools: toolFingerprint } : {}),
    ...(modelName ? { model: modelName } : {}),
  })
  return createHash('sha256').update(dynamicInputs).digest('hex')
}

export function getToolFingerprint(tools: LLMToolDefinition[]): string {
  return tools
    .map((t) => `${t.function.name}:${JSON.stringify(t.function.parameters)}`)
    .sort()
    .join('|')
}

/**
 * Compute a diff of tool names between two tool lists.
 * Returns added/removed lines (removals first) for tools present in only one list.
 */
export function computeToolDiff(oldTools: LLMToolDefinition[], newTools: LLMToolDefinition[]): DiffLine[] {
  const oldNames = oldTools.map((t) => t.function.name).sort()
  const newNames = newTools.map((t) => t.function.name).sort()
  const oldSet = new Set(oldNames)
  const newSet = new Set(newNames)
  const result: DiffLine[] = []
  for (const name of oldNames) {
    if (!newSet.has(name)) result.push({ type: 'removed', content: name })
  }
  for (const name of newNames) {
    if (!oldSet.has(name)) result.push({ type: 'added', content: name })
  }
  return result
}

/**
 * Compute the tool diff shown in the apply-dynamic-context preview.
 * Baseline: cached prompt tools if present, otherwise the unfiltered registry
 * (all MCP tools, no session overrides) so tool add/remove is visible even
 * before a cached prompt exists.
 */
export function computePreviewToolDiff(
  oldCachedTools: LLMToolDefinition[] | undefined,
  unfilteredTools: LLMToolDefinition[],
  newTools: LLMToolDefinition[],
): DiffLine[] {
  const baseline = oldCachedTools && oldCachedTools.length > 0 ? oldCachedTools : unfilteredTools
  return computeToolDiff(baseline, newTools)
}

// ============================================================================
// Incremental change detection + system-reminder injection
// ============================================================================

const MAX_DESCRIPTION_LENGTH = 80

export interface AddedToolInfo {
  name: string
  description: string | undefined
  params: string[]
}

export interface ToolChanges {
  added: AddedToolInfo[]
  removed: string[]
  changed: string[]
}

export interface ReminderInjectionOptions {
  modelName: string
  instructionContent: string
  skills: SkillMetadata[]
  /** Builds the freshly computed system prompt text, lazily — only invoked
   *  when the cheap prompt hash indicates drift. Diffed against the cached text. */
  buildNewSystemPrompt: () => string
}

export interface ReminderInjectionResult {
  injectedToolReminder: boolean
  injectedPromptReminder: boolean
}

/**
 * Fingerprint of a tool definition covering name, description and parameters.
 * Two tools with the same name but different description/parameters are
 * considered "changed" by detectToolChanges.
 */
export function getToolSignature(tool: LLMToolDefinition): string {
  const fn = tool.function
  return `${fn.name}:${fn.description ?? ''}:${JSON.stringify(fn.parameters)}`
}

/**
 * Compare the live tool set against the cached tool set.
 * Returns added (with description + param names), removed (names) and changed
 * (same name, different description/parameters) tool lists.
 */
export function detectToolChanges(liveTools: LLMToolDefinition[], cachedTools: LLMToolDefinition[]): ToolChanges {
  const liveByName = new Map(liveTools.map((t) => [t.function.name, t]))
  const cachedByName = new Map(cachedTools.map((t) => [t.function.name, t]))
  const added: AddedToolInfo[] = []
  const removed: string[] = []
  const changed: string[] = []

  for (const name of liveByName.keys()) {
    const liveTool = liveByName.get(name)!
    const cachedTool = cachedByName.get(name)
    if (!cachedTool) {
      const properties = liveTool.function.parameters?.['properties'] as Record<string, unknown> | undefined
      added.push({
        name,
        description: liveTool.function.description,
        params: Object.keys(properties ?? {}),
      })
    } else if (getToolSignature(liveTool) !== getToolSignature(cachedTool)) {
      changed.push(name)
    }
  }
  for (const name of cachedByName.keys()) {
    if (!liveByName.has(name)) removed.push(name)
  }

  added.sort((a, b) => a.name.localeCompare(b.name))
  removed.sort()
  changed.sort()
  return { added, removed, changed }
}

function hasToolChanges(changes: ToolChanges): boolean {
  return changes.added.length > 0 || changes.removed.length > 0 || changes.changed.length > 0
}

function truncateDescription(description: string | undefined): string | undefined {
  if (!description) return undefined
  const trimmed = description.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= MAX_DESCRIPTION_LENGTH) return trimmed
  return trimmed.slice(0, MAX_DESCRIPTION_LENGTH - 1) + '…'
}

function formatAddedTool(tool: AddedToolInfo): string {
  const description = truncateDescription(tool.description)
  const params = tool.params.length > 0 ? ` (params: ${tool.params.join(', ')})` : ''
  return description ? `${tool.name} — ${description}${params}` : `${tool.name}${params}`
}

/**
 * Render a compact <system-reminder> describing tool changes.
 * Returns null when there is nothing to announce.
 */
export function renderToolChangeReminder(changes: ToolChanges): string | null {
  if (!hasToolChanges(changes)) return null
  const sections: string[] = []
  if (changes.added.length > 0) {
    sections.push(`Added:\n${changes.added.map(formatAddedTool).join('\n')}`)
  }
  if (changes.removed.length > 0) {
    sections.push(`Removed:\n${changes.removed.join('\n')}`)
  }
  if (changes.changed.length > 0) {
    sections.push(`Changed:\n${changes.changed.join('\n')}`)
  }
  return `<system-reminder>\nThe available tools have changed since your last turn:\n${sections.join(
    '\n',
  )}\n</system-reminder>`
}

const MAX_PROMPT_DIFF_LINES = 40
const MAX_PROMPT_DIFF_LINE_LENGTH = 200

/**
 * Render a <system-reminder> containing the unified diff between the cached
 * system prompt and the freshly built one. Returns null when identical.
 * The diff is capped so a large prompt rewrite cannot bloat the context.
 */
export function renderSystemPromptDiff(oldPrompt: string, newPrompt: string): string | null {
  const diff = computeUnifiedDiff(oldPrompt, newPrompt)
  const changedLines = diff.filter((line) => line.type !== 'unchanged')
  if (changedLines.length === 0) return null
  const visible = changedLines.slice(0, MAX_PROMPT_DIFF_LINES)
  const lines = visible.map((line) => {
    const marker = line.type === 'added' ? '+' : '-'
    const content =
      line.content.length > MAX_PROMPT_DIFF_LINE_LENGTH
        ? line.content.slice(0, MAX_PROMPT_DIFF_LINE_LENGTH) + '…'
        : line.content
    return `${marker} ${content}`
  })
  const omitted = changedLines.length - visible.length
  if (omitted > 0) {
    lines.push(`… ${omitted} more line${omitted === 1 ? '' : 's'} omitted`)
  }
  return `<system-reminder>\nYour system prompt has changed:\n${lines.join('\n')}\n</system-reminder>`
}

function injectSystemReminder(
  sessionId: string,
  append: (event: TurnEvent) => void,
  content: string,
  type: string,
  name: string,
): void {
  const currentWindowId = getCurrentContextWindowId(sessionId)
  const reminderMsgId = randomUUID()
  append({
    type: 'message.start',
    data: {
      messageId: reminderMsgId,
      role: 'user',
      content,
      ...(currentWindowId ? { contextWindowId: currentWindowId } : {}),
      isSystemGenerated: true,
      messageKind: 'auto-prompt',
      metadata: { type, name, color: '#6b7280', kind: 'reminder' },
    },
  })
  append({
    type: 'message.done',
    data: { messageId: reminderMsgId },
  })
}

/**
 * Compare the live tool set and freshly built system prompt against the cached
 * prompt, and inject <system-reminder>s for any drift. Shared core used both
 * at the start of a top-level turn and at the point of contention (tool /
 * system-prompt changes) for instant visibility.
 *
 * Tool drift is resolved by syncing ONLY the cached tools to the live set
 * (same system prompt text + recomputed hash) so the reminder fires exactly
 * once per change and the new tools are callable immediately. The system
 * prompt text stays frozen — this never calls applyDynamicContext.
 *
 * Prompt drift is announced once per change (tracked via the session's
 * announced prompt hash) and the cache is left untouched — a manual rebase
 * (applyDynamicContext) or a new context window rebuilds the canonical text.
 */
async function injectDriftReminders(
  sessionManager: SessionManager,
  sessionId: string,
  agentDef: AgentDefinition,
  options: ReminderInjectionOptions,
  append: (event: TurnEvent) => void,
): Promise<ReminderInjectionResult> {
  const cached = sessionManager.getCachedPrompt(sessionId)
  if (!cached) {
    return { injectedToolReminder: false, injectedPromptReminder: false }
  }

  const { getToolRegistryForAgent } = await import('../tools/index.js')
  const liveTools = getToolRegistryForAgent(agentDef, sessionId).definitions

  let injectedToolReminder = false
  let injectedPromptReminder = false

  const changes = detectToolChanges(liveTools, cached.tools)
  if (hasToolChanges(changes)) {
    const reminder = renderToolChangeReminder(changes)
    if (reminder) {
      injectSystemReminder(sessionId, append, reminder, 'tools', 'Tools')
      injectedToolReminder = true
    }
    const newHash = computeDynamicContextHash(
      options.instructionContent,
      options.skills,
      getToolFingerprint(liveTools),
      options.modelName,
    )
    sessionManager.setCachedPrompt(sessionId, cached.systemPrompt, liveTools, newHash)
  }

  const livePromptHash = computeDynamicContextHash(
    options.instructionContent,
    options.skills,
    undefined,
    options.modelName,
  )
  const announcedPromptHash = sessionManager.getAnnouncedPromptHash(sessionId) ?? cached.hash
  if (announcedPromptHash !== livePromptHash) {
    // Only build the prompt text when the cheap hash says it drifted — the
    // build is pure string work but the LCS diff can be expensive on big prompts.
    const reminder = renderSystemPromptDiff(cached.systemPrompt, options.buildNewSystemPrompt())
    if (reminder) {
      injectSystemReminder(sessionId, append, reminder, 'system-prompt', 'System Prompt')
      injectedPromptReminder = true
    }
    sessionManager.setAnnouncedPromptHash(sessionId, livePromptHash)
  }

  return { injectedToolReminder, injectedPromptReminder }
}

/**
 * Check for tool/system-prompt drift at the start of a top-level turn and
 * inject <system-reminder>s. The turn-start safety net — the point-of-contention
 * injection (injectContextDriftReminders) already syncs caches, so this fires
 * only for changes made outside known points (skills, instructions files,
 * server restart, etc.).
 */
export async function checkToolChangesAndInject(
  sessionManager: SessionManager,
  sessionId: string,
  agentDef: AgentDefinition,
  options: ReminderInjectionOptions,
  append: (event: TurnEvent) => void,
): Promise<ReminderInjectionResult> {
  return injectDriftReminders(sessionManager, sessionId, agentDef, options, append)
}

function createEventStoreAppend(sessionId: string): (event: TurnEvent) => void {
  return (event) => {
    try {
      getEventStore().append(sessionId, event)
    } catch {
      // Session may have been deleted — skip
    }
  }
}

/**
 * Resolve the concrete model name a turn would actually use (agent override or
 * session preference, with 'auto'/alias expansion) — the same resolution as
 * the orchestrator's `agentLlmClient.getModel()`. Used so the point-of-contention
 * prompt hash matches the turn-start hash (exactly-once prompt reminders).
 */
function resolveConcreteModelName(sessionManager: SessionManager, sessionId: string, agentId: string): string {
  const effective = sessionManager.resolveEffectiveProviderModel(sessionId, agentId)
  if (effective.providerId && effective.model) {
    const pm = sessionManager.getProviderManager()
    const resolvedModel = pm.resolveModel(effective.providerId, effective.model)
    const effectiveModel = resolvedModel ?? effective.model
    const client = pm.createClient(effective.providerId, effectiveModel, effective.reasoningEffort)
    if (client) return client.getModel()
  }
  return sessionManager.getProviderManager().getCurrentModel() ?? ''
}

/**
 * Detect tool/system-prompt drift at the point of contention (e.g. right after
 * MCP tools are rebuilt, or a session's model changes) and inject the
 * <system-reminder>s immediately — the agent sees what changed on its next
 * model call instead of waiting for the next turn start.
 *
 * Self-contained: resolves the session's agent, instructions, skills and
 * effective model. Best-effort — never throws, so callers (tool execution,
 * REST/WS handlers) can fire it without risk. Appends via the event store
 * unless an append closure is provided.
 */
export async function injectContextDriftReminders(
  sessionManager: SessionManager,
  sessionId: string,
  append?: (event: TurnEvent) => void,
): Promise<ReminderInjectionResult> {
  try {
    const allAgents = await loadAllAgentsDefault(sessionManager.getProjectWorkdir(sessionId))
    const session = sessionManager.requireSession(sessionId)
    const agentDef = findAgentById(session.mode, allAgents) ?? findAgentById(resolveDefaultAgentId(), allAgents)!
    const { instructionContent, skills } = await loadSessionContext(sessionManager, sessionId)
    const subAgentDefs = getSubAgents(allAgents)
    const modelName = resolveConcreteModelName(sessionManager, sessionId, agentDef.metadata.id)
    return await injectDriftReminders(
      sessionManager,
      sessionId,
      agentDef,
      {
        modelName,
        instructionContent: instructionContent ?? '',
        skills,
        buildNewSystemPrompt: () =>
          buildTopLevelSystemPrompt(session.workdir, instructionContent || undefined, skills, subAgentDefs, modelName),
      },
      append ?? createEventStoreAppend(sessionId),
    )
  } catch (error) {
    logger.warn('injectContextDriftReminders failed', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { injectedToolReminder: false, injectedPromptReminder: false }
  }
}

/**
 * Inject context-drift reminders for a batch of sessions (e.g. all sessions
 * after a UI-side MCP server change). Best-effort per session — one session
 * failing never blocks the rest.
 */
export async function injectContextDriftRemindersForSessions(
  sessionManager: SessionManager,
  sessionIds: string[],
): Promise<void> {
  for (const sessionId of sessionIds) {
    await injectContextDriftReminders(sessionManager, sessionId)
  }
}

async function loadSessionContext(
  sessionManager: SessionManager,
  sessionId: string,
): Promise<{ instructionContent: string; skills: SkillMetadata[] }> {
  const session = sessionManager.requireSession(sessionId)
  const { content: instructionContent } = await getAllInstructions(session.workdir, session.projectId)
  const runtimeConfig = getRuntimeConfig()
  const configDir = getGlobalConfigDir(runtimeConfig.mode ?? 'production')
  const skills = await getEnabledSkillMetadata(configDir, sessionManager.getProjectWorkdir(sessionId))
  return { instructionContent: instructionContent ?? '', skills }
}

function resolveAgentDef(sessionManager: SessionManager, sessionId: string): Promise<AgentDefinition> {
  return loadAllAgentsDefault(sessionManager.getProjectWorkdir(sessionId)).then((allAgents) => {
    const session = sessionManager.requireSession(sessionId)
    return findAgentById(session.mode, allAgents) ?? findAgentById(resolveDefaultAgentId(), allAgents)!
  })
}

/**
 * Build the cached prompt for a session using the correct filtered tool list.
 * Single source of truth — used by both eager (applyDynamicContext) and lazy
 * (assembleRequest cache-miss) paths.
 */
export async function buildCachedPrompt(
  sessionManager: SessionManager,
  sessionId: string,
  agentDef: AgentDefinition,
  modelName?: string,
): Promise<{ systemPrompt: string; tools: LLMToolDefinition[]; hash: string; promptHash: string }> {
  const { instructionContent, skills } = await loadSessionContext(sessionManager, sessionId)

  const { getToolRegistryForAgent } = await import('../tools/index.js')
  const tools = getToolRegistryForAgent(agentDef, sessionId).definitions
  const toolFingerprint = getToolFingerprint(tools)

  const allAgents = await loadAllAgentsDefault(sessionManager.getProjectWorkdir(sessionId))
  const subAgentDefs = getSubAgents(allAgents)
  const session = sessionManager.requireSession(sessionId)
  const systemPrompt = buildTopLevelSystemPrompt(
    session.workdir,
    instructionContent || undefined,
    skills,
    subAgentDefs,
    modelName,
  )

  const hash = computeDynamicContextHash(instructionContent, skills, toolFingerprint, modelName)
  // Tool-independent hash — the drift domain for system-prompt-change reminders.
  const promptHash = computeDynamicContextHash(instructionContent, skills, undefined, modelName)

  return { systemPrompt, tools, hash, promptHash }
}

/**
 * Compute the dynamic context hash for a session using the correct filtered tool list.
 * Used by context.checkDynamic and session.load to detect drift.
 */
export async function computeSessionHash(
  sessionManager: SessionManager,
  sessionId: string,
  modelName?: string,
): Promise<string> {
  const { instructionContent, skills } = await loadSessionContext(sessionManager, sessionId)
  const agentDef = await resolveAgentDef(sessionManager, sessionId)

  const { getToolRegistryForAgent } = await import('../tools/index.js')
  const tools = getToolRegistryForAgent(agentDef, sessionId).definitions
  const toolFingerprint = getToolFingerprint(tools)

  return computeDynamicContextHash(instructionContent, skills, toolFingerprint, modelName)
}

export async function applyDynamicContext(
  sessionManager: SessionManager,
  sessionId: string,
  modelName?: string,
): Promise<void> {
  const session = sessionManager.requireSession(sessionId)
  const allAgents = await loadAllAgentsDefault(sessionManager.getProjectWorkdir(sessionId))
  const agentDef = findAgentById(session.mode, allAgents) ?? findAgentById(resolveDefaultAgentId(), allAgents)!
  const { systemPrompt, tools, hash, promptHash } = await buildCachedPrompt(
    sessionManager,
    sessionId,
    agentDef,
    modelName,
  )

  sessionManager.setCachedPrompt(sessionId, systemPrompt, tools, hash)
  sessionManager.setAnnouncedPromptHash(sessionId, promptHash)
  sessionManager.setDynamicContextChanged(sessionId, false)
  sessionManager.clearDebugDump(sessionId)
  logger.debug('applyDynamicContext done', { sessionId, hash, toolCount: tools.length })
}
