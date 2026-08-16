import type { Session, SessionPhase, WorkflowExecution } from '@shared/types.js'

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
  lastActivityAt: string | null
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
    lastActivityAt: null,
  }
}

export interface ProjectFromSessionStoreInputs {
  currentSession: Session | null
  pendingQuestions: unknown[]
  pendingPathConfirmations: unknown[]
  activeWorkflowExecution: WorkflowExecution | null | undefined
}

export function projectFromSessionStore(inputs: ProjectFromSessionStoreInputs): SessionStatusView & {
  lastActivityAt: string | null
} {
  const { currentSession, pendingQuestions, pendingPathConfirmations, activeWorkflowExecution } = inputs

  if (!currentSession) {
    return {
      state: null,
      waitingForUser: false,
      workflowStep: null,
      lastActivityAt: null,
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
    lastActivityAt: currentSession.updatedAt,
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
