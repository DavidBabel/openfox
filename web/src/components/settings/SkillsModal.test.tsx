// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSkillsStore, type SkillInfo } from '../../stores/skills'
import { useSessionStore } from '../../stores/session/store'
import { clearCache } from '../../lib/resourceCache'
import { skillsResource } from '../../lib/resources'
import { authFetch } from '../../lib/api'
import { SkillsContent } from './SkillsModal'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../../lib/api', () => ({
  authFetch: vi.fn(),
}))

const skill: SkillInfo = {
  id: 'my-skill',
  name: 'My Skill',
  description: 'Test skill',
  version: '1',
  enabled: false,
  source: 'global-openfox',
  path: '/tmp/skills/my-skill/SKILL.md',
  legacy: false,
  readOnly: false,
  warnings: [],
}

function seedSkills(workdir?: string) {
  vi.mocked(authFetch).mockImplementation(async (url: string) => {
    if (url === `/api/skills${workdir ? `?workdir=${encodeURIComponent(workdir)}` : ''}`) {
      return {
        ok: true,
        json: async () => ({
          defaults: [],
          userItems: [skill],
          projectItems: [],
          items: [skill],
          selectedDirectory: {
            configuredPath: '/tmp/skills',
            resolvedPath: '/tmp/skills',
            available: true,
            custom: false,
          },
          diagnostics: [],
        }),
      } as unknown as Response
    }
    return { ok: true, json: async () => ({}) } as unknown as Response
  })
}

describe('SkillsContent', () => {
  afterEach(cleanup)

  beforeEach(async () => {
    vi.clearAllMocks()
    clearCache()
    seedSkills()
    await skillsResource.refresh()
  })

  it('shows activation next to delete and toggles the skill', () => {
    const toggleSkill = vi.fn()
    useSkillsStore.setState({ toggleSkill })

    render(<SkillsContent isOpen={false} />)

    const activation = screen.getByRole('switch', { name: 'Activation for My Skill' })
    const deleteButton = screen.getByTitle('Delete')
    expect(activation.getAttribute('aria-checked')).toBe('false')
    expect(activation.parentElement).toBe(deleteButton.parentElement)
    expect(activation.parentElement?.lastElementChild).toBe(activation)

    fireEvent.click(activation)
    expect(toggleSkill).toHaveBeenCalledWith('my-skill', undefined)
  })

  it('requires modal confirmation before deleting the full skill folder', async () => {
    const deleteSkill = vi.fn(async () => ({ success: true }))
    useSkillsStore.setState({ deleteSkill })

    render(<SkillsContent isOpen={false} />)
    fireEvent.click(screen.getByTitle('Delete'))

    expect(screen.getByText('This skill files will be deleted.')).toBeTruthy()
    expect(screen.getByText('The full skill folder and all its contents will be removed.')).toBeTruthy()
    expect(deleteSkill).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Delete skill' }))
    await vi.waitFor(() => expect(deleteSkill).toHaveBeenCalledWith('my-skill', undefined))
  })

  it('loads skills scoped to the session project workdir even when a workspace is active', async () => {
    useSessionStore.setState({
      currentSession: {
        id: 's1',
        projectId: 'p1',
        workdir: '/original/project',
        workspace: '/workspaces/openfox/review-branch',
        mode: 'planner',
        phase: 'plan',
        isRunning: false,
      } as any,
    })

    render(<SkillsContent isOpen={true} />)

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith('/api/skills?workdir=%2Foriginal%2Fproject')
    })
  })
})
