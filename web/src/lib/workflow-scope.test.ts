import { describe, expect, it } from 'vitest'
import { resolveEffectiveWorkflow, resolveWorkflowForLaunch, SCOPE_LABELS } from './workflow-scope'

interface Item {
  id: string
  scope: 'builtin' | 'user' | 'project'
  name: string
}

const item = (id: string, scope: Item['scope'], name: string): Item => ({ id, scope, name })

const dualReview = () => [
  item('review', 'builtin', 'Built-in Review'),
  item('review', 'user', 'Global Review'),
  item('review', 'project', 'Project Review'),
]

describe('SCOPE_LABELS', () => {
  it('maps every scope to a display label', () => {
    expect(SCOPE_LABELS.builtin).toBe('Built-in')
    expect(SCOPE_LABELS.user).toBe('Global')
    expect(SCOPE_LABELS.project).toBe('Project')
  })
})

describe('resolveEffectiveWorkflow', () => {
  it('returns undefined when the id is absent', () => {
    expect(resolveEffectiveWorkflow([item('sandbox', 'project', 'Sandbox')], 'review')).toBeUndefined()
  })

  it('returns the only matching item', () => {
    const wf = item('review', 'project', 'Project Review')
    expect(resolveEffectiveWorkflow([item('default', 'builtin', 'Build'), wf], 'review')).toBe(wf)
  })

  it('prefers project over user and builtin', () => {
    const project = item('review', 'project', 'Project Review')
    const user = item('review', 'user', 'Global Review')
    const builtin = item('review', 'builtin', 'Built-in Review')
    expect(resolveEffectiveWorkflow([builtin, user, project], 'review')).toBe(project)
  })

  it('prefers user over builtin when no project copy exists', () => {
    const user = item('review', 'user', 'Global Review')
    const builtin = item('review', 'builtin', 'Built-in Review')
    expect(resolveEffectiveWorkflow([builtin, user], 'review')).toBe(user)
  })

  it('returns the builtin copy when nothing else matches', () => {
    const builtin = item('default', 'builtin', 'Build & Verify')
    expect(resolveEffectiveWorkflow([builtin], 'default')).toBe(builtin)
  })
})

describe('resolveWorkflowForLaunch', () => {
  it('honors an explicit scope over the precedence winner', () => {
    const workflows = dualReview()
    expect(resolveWorkflowForLaunch(workflows, 'review', 'user')).toBe(workflows[1])
    expect(resolveWorkflowForLaunch(workflows, 'review', 'builtin')).toBe(workflows[0])
  })

  it('falls back to the effective definition when the chosen scope lacks the id', () => {
    const [builtin, user] = dualReview()
    const noProject = [builtin!, user!]
    // Only user + builtin exist for this id; requesting project falls back to user (effective).
    expect(resolveWorkflowForLaunch(noProject, 'review', 'project')).toBe(user)
  })

  it('resolves by precedence for auto', () => {
    const workflows = dualReview()
    expect(resolveWorkflowForLaunch(workflows, 'review', 'auto')).toBe(workflows[2])
  })

  it('returns undefined when the id is absent everywhere', () => {
    expect(resolveWorkflowForLaunch(dualReview(), 'missing', 'auto')).toBeUndefined()
    expect(resolveWorkflowForLaunch(dualReview(), 'missing', 'user')).toBeUndefined()
  })
})
