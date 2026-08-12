import { useEffect, useState } from 'react'
import { useProjectStore } from '../../stores/project'
import { useSessionStore } from '../../stores/session'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { FolderIcon } from '../shared/icons'
import { truncateMiddle } from '../../lib/path'

interface SplitNewSessionModalProps {
  isOpen: boolean
  onClose: () => void
}

/** Project picker for creating a session straight into the split view. */
export function SplitNewSessionModal({ isOpen, onClose }: SplitNewSessionModalProps) {
  const projects = useProjectStore((state) => state.projects)
  const listProjects = useProjectStore((state) => state.listProjects)
  const createSession = useSessionStore((state) => state.createSession)
  const openPane = useSessionStore((state) => state.openPane)
  const resetPendingSessionCreate = useSessionStore((state) => state.resetPendingSessionCreate)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setCreating(false)
      setError(null)
      void listProjects()
    }
  }, [isOpen, listProjects])

  const handleSelect = async (projectId: string) => {
    if (creating) return
    setCreating(true)
    setError(null)
    try {
      const session = await createSession(projectId)
      if (!session) {
        setError('Could not create the session — please try again.')
        return
      }
      await openPane(session.id, { focus: true })
      resetPendingSessionCreate()
      onClose()
    } catch {
      setError('Could not create the session — please try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New session"
      size="sm"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-muted mb-3">Choose the project for the new session.</p>
      {error && (
        <div className="mb-3 px-3 py-2 rounded bg-accent-error/10 border border-accent-error/30 text-sm text-accent-error">
          {error}
        </div>
      )}
      {projects.length === 0 ? (
        <p className="text-sm text-text-muted">No projects yet — create one from the home page first.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => void handleSelect(project.id)}
              disabled={creating}
              className="flex items-center gap-3 rounded px-3 py-2 text-left hover:bg-bg-tertiary transition-colors disabled:opacity-50"
            >
              <FolderIcon className="w-4 h-4 text-accent-primary shrink-0" />
              <span className="font-medium truncate text-sm">{project.name}</span>
              <span className="text-xs text-text-muted truncate ml-auto">{truncateMiddle(project.workdir, 24)}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
