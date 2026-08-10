import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import { useTasksStore } from '../../stores/tasks'
import { Button } from '../shared/Button'
import { TasksIcon, ArrowRightIcon } from '../shared/icons'
import type { ProjectTask } from '@shared/types.js'

interface EmptyFeedTaskCardProps {
  projectId: string
}

/**
 * "Work on next task" — shown above the composer only when the feed is empty
 * and at least one open, unclaimed task exists. Claims the topmost To Do card
 * (not bound to a session) with one click: it moves to In Progress, seeds a
 * new session, and the feed transitions to the task's first prompt.
 */
export function EmptyFeedTaskCard({ projectId }: EmptyFeedTaskCardProps) {
  const [, navigate] = useLocation()
  const tasks = useTasksStore((state) => state.tasks)
  const activeProjectId = useTasksStore((state) => state.activeProjectId)
  const loadBoard = useTasksStore((state) => state.loadBoard)
  const moveTask = useTasksStore((state) => state.moveTask)
  const lastError = useTasksStore((state) => state.lastError)

  useEffect(() => {
    if (activeProjectId !== projectId) {
      void loadBoard(projectId)
    }
  }, [activeProjectId, projectId, loadBoard])

  const nextTask = useMemo(() => {
    const candidate = tasks
      .filter((t: ProjectTask) => t.status === 'todo' && t.sessionIds.length === 0)
      .sort((a, b) => a.position - b.position)[0]
    return candidate ?? null
  }, [tasks])

  const [queuedNotice, setQueuedNotice] = useState<{ label: string } | null>(null)

  if (queuedNotice) {
    return (
      <div className="mx-auto max-w-xl w-full">
        <div className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-text-primary">
              “{queuedNotice.label}” is queued — it’ll start automatically when a slot frees.
            </p>
            <button
              type="button"
              onClick={() => setQueuedNotice(null)}
              title="Dismiss"
              className="shrink-0 text-sm text-text-muted underline hover:text-text-primary transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!nextTask) return null

  const startTask = async () => {
    const result = await moveTask(projectId, nextTask.id, 'in_progress')
    if (result?.sessionId) {
      navigate(`/p/${projectId}/s/${result.sessionId}`)
    } else if (result?.task && result.task.status === 'in_progress' && result.task.runState === 'queued') {
      setQueuedNotice({ label: nextTask.prompt.split('\n')[0]?.slice(0, 60) || 'This task' })
    }
  }

  return (
    <div className="mx-auto max-w-xl w-full">
      <div className="rounded-lg border border-border bg-bg-secondary/60 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-text-muted">
          <TasksIcon className="w-3.5 h-3.5" />
          Work on next task
        </div>
        <p className="mt-2 text-sm text-text-primary font-medium leading-snug line-clamp-2 break-words whitespace-pre-wrap">
          {nextTask.prompt}
        </p>
        <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
          {nextTask.attachments.length > 0 && <span>📎 {nextTask.attachments.length}</span>}
          {nextTask.model && (
            <span className="px-1.5 py-0.5 rounded bg-bg-tertiary border border-border">{nextTask.model}</span>
          )}
        </div>
        <Button variant="primary" size="md" onClick={() => void startTask()} className="mt-3 flex items-center gap-1.5">
          Start task <ArrowRightIcon className="w-3.5 h-3.5" />
        </Button>
        {lastError && <div className="mt-2 text-sm text-accent-error">{lastError}</div>}
      </div>
    </div>
  )
}
