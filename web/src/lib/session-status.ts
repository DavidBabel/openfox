import type { Message, Session, SessionPhase, WorkflowExecution } from '@shared/types.js'

export type SessionStatusState = 'waiting' | 'blocked' | 'completed' | 'running' | null

export interface ProjectSessionStatusInputs {
  phase: SessionPhase
  isRunning: boolean
  pendingQuestionsCount: number
  pendingConfirmationsCount: number
  activeWorkflow: WorkflowExecution | null | undefined
}

export interface SessionStatusView {
  state: SessionStatusState
  waitingForUser: boolean
  workflowStep: string | null
  lastPromptAt: string | null
}

export function projectClientSessionStatus(inputs: ProjectSessionStatusInputs): SessionStatusView {
  const { phase, isRunning, pendingQuestionsCount, pendingConfirmationsCount, activeWorkflow } = inputs

  let state: SessionStatusState = null
  if (phase === 'waiting' || pendingQuestionsCount > 0 || pendingConfirmationsCount > 0) {
    state = 'waiting'
  } else if (phase === 'blocked') {
    state = 'blocked'
  } else if (phase === 'done' && !isRunning) {
    state = 'completed'
  } else if (isRunning) {
    state = 'running'
  }

  const waitingForUser = pendingQuestionsCount > 0 || pendingConfirmationsCount > 0

  const workflowStep = activeWorkflow?.currentStepName ?? null

  return {
    state,
    waitingForUser,
    workflowStep,
    lastPromptAt: null,
  }
}

/**
 * Timestamp of the last user-initiated action in a session: the most recent
 * real user prompt, or a workflow-started marker (launching a workflow resets
 * the "time since" counter instead of falling back to an unrelated older
 * prompt). System-generated user-role messages (auto-prompts, corrections,
 * commands) never count. Mirrors the server's "real user message" definition.
 */
export function lastUserPromptAt(messages: Message[] | undefined): string | null {
  if (!messages || messages.length === 0) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (!message || message.role !== 'user') continue
    if (message.messageKind === 'workflow-started') return message.timestamp
    if (!message.isSystemGenerated && !message.messageKind) return message.timestamp
  }
  return null
}

export interface ProjectFromSessionStoreInputs {
  currentSession: Session | null
  messages?: Message[]
  pendingQuestions: unknown[]
  pendingPathConfirmations: unknown[]
  activeWorkflowExecution: WorkflowExecution | null | undefined
}

export function projectFromSessionStore(inputs: ProjectFromSessionStoreInputs): SessionStatusView & {
  lastPromptAt: string | null
} {
  const { currentSession, messages = [], pendingQuestions, pendingPathConfirmations, activeWorkflowExecution } = inputs

  if (!currentSession) {
    return {
      state: null,
      waitingForUser: false,
      workflowStep: null,
      lastPromptAt: null,
    }
  }

  const view = projectClientSessionStatus({
    phase: currentSession.phase,
    isRunning: currentSession.isRunning,
    pendingQuestionsCount: pendingQuestions?.length ?? 0,
    pendingConfirmationsCount: pendingPathConfirmations?.length ?? 0,
    activeWorkflow: activeWorkflowExecution,
  })

  return {
    ...view,
    lastPromptAt: lastUserPromptAt(messages),
  }
}

export function statusLabel(state: SessionStatusState): string {
  switch (state) {
    case 'running':
      return 'Running'
    case 'waiting':
      return 'Waiting for input'
    case 'completed':
      return 'Completed'
    case 'blocked':
      return 'Blocked'
    case null:
      return ''
  }
}
