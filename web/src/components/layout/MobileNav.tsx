import { Link } from 'wouter'
import type { SessionSummary } from '@shared/types.js'
import { useT } from '../../hooks/useT'
import { InlineDropdown, type InlineDropdownItem } from '../shared/InlineDropdown'
import { PlusIcon, CheckIcon, ArchiveIcon } from '../shared/icons'
import { trimContent } from '../../lib/cross-session-history'

interface MobileNavProps {
  currentProject: { id: string; name: string; workdir: string } | null
  sessions: SessionSummary[]
  currentSession: { id: string; metadata?: { title?: string } } | null
  projectIdFromUrl: string | null
}

export function MobileNav({ currentProject, sessions, currentSession, projectIdFromUrl }: MobileNavProps) {
  const t = useT()
  if (!currentProject?.id || currentProject.id !== projectIdFromUrl) {
    return null
  }

  const projectSessions = sessions
    .filter((s) => s.projectId === currentProject.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  const items: InlineDropdownItem[] = [
    {
      label: (
        <Link href={`/p/${currentProject.id}/new`} className="flex items-center gap-2">
          <PlusIcon className="w-3 h-3 text-accent-primary" />
          <span className="text-sm">{t({ en: 'New Session', fr: 'Nouvelle session' })}</span>
        </Link>
      ),
    },
    ...projectSessions.map((session) => ({
      label: (
        <Link href={`/p/${currentProject.id}/s/${session.id}`} className="flex items-center gap-2 truncate text-sm">
          <span>{trimContent(session.title ?? session.id.slice(0, 8), 50)}</span>
        </Link>
      ),
      icon: session.id === currentSession?.id ? <CheckIcon className="w-3 h-3" /> : undefined,
    })),
    {
      label: (
        <Link href="/" className="flex items-center gap-2 text-text-muted hover:text-text-primary">
          <ArchiveIcon className="w-3 h-3" />
          <span className="text-sm">{t({ en: 'Projects', fr: 'Projets' })}</span>
        </Link>
      ),
    },
  ]

  return (
    <InlineDropdown
      items={items}
      trigger={<span className="text-sm text-text-secondary font-medium">{currentProject.name}</span>}
    />
  )
}
