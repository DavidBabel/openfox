import { createContext, useContext } from 'react'
import { useSessionStore } from '../../stores/session'
import type { SessionPane, SessionState } from '../../stores/session/types'

/**
 * Resolves the session a component's actions should target. Wrapped by
 * SessionScopeProvider inside split panes; outside a pane it falls back to the
 * focused session so existing single-session components keep working.
 */
export const SessionScopeContext = createContext<string | null>(null)

export const SessionScopeProvider = SessionScopeContext.Provider

export function useSessionScope(): string | null {
  const scoped = useContext(SessionScopeContext)
  if (scoped) return scoped
  return useSessionStore((state) => state.focusedSessionId ?? state.currentSession?.id ?? null)
}

/**
 * Select a per-session field with a flat fallback: when the scoped session is
 * still flat-backed (pane not yet materialized, or legacy test seeding), read
 * the focused flat field instead of returning a bare default.
 */
export function useScopedPaneState<T>(
  scopeId: string | null | undefined,
  pick: (pane: SessionPane) => T,
  flatPick: (state: SessionState) => T,
  fallback: T,
): T {
  return useSessionStore((state) => {
    if (scopeId) {
      const pane = state.panes?.[scopeId]
      if (pane) return pick(pane)
      if (state.currentSession?.id === scopeId) return flatPick(state)
      return fallback
    }
    return flatPick(state)
  })
}
