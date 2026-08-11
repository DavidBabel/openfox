import { useSessionStore } from './store'
import type { PendingQuestion } from './types'

export function useIsRunning(sessionId?: string | null) {
  return useSessionStore((state) => {
    if (sessionId) {
      if (state.panes?.[sessionId]) return state.panes?.[sessionId]?.session?.isRunning ?? false
      if (state.currentSession?.id === sessionId) return state.currentSession.isRunning ?? false
      return false
    }
    return state.currentSession?.isRunning ?? false
  })
}

export function useQueuedMessages(sessionId?: string | null) {
  return useSessionStore((state) => {
    if (sessionId) {
      if (state.panes?.[sessionId]) return state.panes?.[sessionId]?.queuedMessages ?? []
      if (state.currentSession?.id === sessionId) return state.queuedMessages
      return []
    }
    return state.queuedMessages
  })
}

export function useAbortInProgress(sessionId?: string | null) {
  return useSessionStore((state) => {
    if (sessionId) {
      if (state.panes?.[sessionId]) return state.panes?.[sessionId]?.abortInProgress ?? false
      if (state.currentSession?.id === sessionId) return state.abortInProgress
      return false
    }
    return state.abortInProgress
  })
}

export function usePendingQuestions(sessionId?: string | null): PendingQuestion[] {
  return useSessionStore((state) => {
    if (sessionId) {
      if (state.panes?.[sessionId]) return state.panes?.[sessionId]?.pendingQuestions ?? []
      if (state.currentSession?.id === sessionId) return state.pendingQuestions
      return []
    }
    return state.pendingQuestions
  })
}

export function useVisionFallbackItems(sessionId?: string | null) {
  return useSessionStore((state) => {
    if (sessionId) {
      if (state.panes?.[sessionId]) return state.panes?.[sessionId]?.visionFallbackByMessage ?? {}
      if (state.currentSession?.id === sessionId) return state.visionFallbackByMessage
      return {}
    }
    return state.visionFallbackByMessage
  })
}

export function useVisionFallbackForMessage(messageId: string, attachmentId?: string, sessionId?: string | null) {
  return useSessionStore((state) => {
    if (!attachmentId) return undefined
    const key = `${messageId}-${attachmentId}`
    if (sessionId) {
      if (state.panes?.[sessionId]) return state.panes?.[sessionId]?.visionFallbackByMessage[key]
      if (state.currentSession?.id === sessionId) return state.visionFallbackByMessage[key]
      return undefined
    }
    return state.visionFallbackByMessage[key]
  })
}
