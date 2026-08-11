import { useEffect, useMemo, useRef, useState } from 'react'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { PlanPanel } from '../plan/PlanPanel'
import { XCloseIcon, MenuIcon } from '../shared/icons'

// Container-query threshold is 768px; leave margin so the inline sidebar fits.
const CRITERIA_MIN_WIDTH = 788

interface SessionPaneProps {
  sessionId: string
  focused: boolean
  onFocus: () => void
  onClose: () => void
  /** Extra classes for the outer pane element (e.g. flex sizing in columns mode). */
  className?: string
}

export function SessionPane({ sessionId, focused, onFocus, onClose, className }: SessionPaneProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  // The criteria sidebar follows the pane's width regime: open inline on wide
  // panes, closed (mobile-like overlay) on narrow ones so the chat input stays
  // usable. Manual toggles win until the pane crosses the width threshold.
  const [criteriaOpen, setCriteriaOpen] = useState(false)
  const overrideRef = useRef(false)
  const wideRef = useRef<boolean | null>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const wide = el.clientWidth >= CRITERIA_MIN_WIDTH
      if (wideRef.current !== null && wideRef.current !== wide) {
        overrideRef.current = false
      }
      wideRef.current = wide
      if (!overrideRef.current) {
        setCriteriaOpen(wide)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const pane = useSessionStore((state) => state.panes[sessionId])
  const projectId = pane?.session?.projectId
  const project = useProjectStore((state) => (projectId ? state.projects.find((p) => p.id === projectId) : undefined))
  const title = pane?.session?.metadata?.title ?? sessionId.slice(0, 8)
  const isRunning = pane?.session?.isRunning ?? false
  const confirmationsCount = pane?.pendingPathConfirmations.length ?? 0
  const questionsCount = pane?.pendingQuestions.length ?? 0

  const attention = useMemo(() => {
    const badges: string[] = []
    if (questionsCount > 0) badges.push(`${questionsCount} question${questionsCount > 1 ? 's' : ''}`)
    if (confirmationsCount > 0) badges.push(`${confirmationsCount} confirmation${confirmationsCount > 1 ? 's' : ''}`)
    return badges
  }, [questionsCount, confirmationsCount])

  return (
    <div
      ref={rootRef}
      data-split-pane={sessionId}
      data-focused={focused ? 'true' : 'false'}
      className={`${className ?? ''} @container relative flex flex-col min-w-0 min-h-0 overflow-hidden ${
        focused ? 'ring-1 ring-inset ring-accent-primary/50' : ''
      }`}
      onClick={onFocus}
    >
      <div className="flex items-center gap-2 px-2 h-8 border-b border-border bg-secondary shrink-0">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted/40'}`}
          title={isRunning ? 'Running' : 'Not running'}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-primary shrink-0 max-w-[80px] truncate">
          {project?.name ?? (projectId ? projectId.slice(0, 10) : '…')}
        </span>
        <span className="text-xs text-text-primary truncate flex-1 min-w-0" title={title}>
          {title}
        </span>
        {attention.length > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400 shrink-0" title={attention.join(' · ')}>
            {attention.join(' · ')}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            overrideRef.current = true
            setCriteriaOpen((open) => !open)
          }}
          className={`p-1 rounded hover:bg-bg-tertiary transition-colors shrink-0 ${
            criteriaOpen ? 'text-accent-primary' : 'text-text-muted hover:text-text-primary'
          }`}
          title={criteriaOpen ? 'Hide criteria sidebar' : 'Show criteria sidebar'}
          aria-label={criteriaOpen ? 'Hide criteria sidebar' : 'Show criteria sidebar'}
        >
          <MenuIcon className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors shrink-0"
          title="Close pane"
          aria-label="Close pane"
        >
          <XCloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 min-h-0 min-w-0 bg-primary relative">
        <PlanPanel
          sessionId={sessionId}
          criteriaSidebarOpen={criteriaOpen}
          onCriteriaSidebarToggle={() => {
            overrideRef.current = true
            setCriteriaOpen((o) => !o)
          }}
        />
      </div>
    </div>
  )
}
