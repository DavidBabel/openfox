import { describe, expect, it } from 'vitest'
import { resolveEffectiveEffort, shouldGateEffortChange, resolveWorkflowFirstAgentId } from './effort-gate'

describe('resolveEffectiveEffort', () => {
  it('an active manual pick wins', () => {
    expect(
      resolveEffectiveEffort({
        session: {
          providerReasoningEffort: 'none',
          providerPinnedEffort: 'high',
          providerManual: true,
          providerManualActive: true,
        },
        agentOverrideEffort: 'max',
        modelDefaultEffort: 'medium',
      }),
    ).toBe('none')
  })

  it('an active manual pick with no effort ignores pin and override (model default applies)', () => {
    expect(
      resolveEffectiveEffort({
        session: {
          providerReasoningEffort: null,
          providerPinnedEffort: 'high',
          providerManual: true,
          providerManualActive: true,
        },
        agentOverrideEffort: 'max',
        modelDefaultEffort: 'medium',
      }),
    ).toBe('medium')
  })

  it('pinned effort beats agent override and session-stored efforts', () => {
    expect(
      resolveEffectiveEffort({
        session: { providerPinnedEffort: 'high', providerReasoningEffort: 'low' },
        agentOverrideEffort: 'max',
        modelDefaultEffort: 'medium',
      }),
    ).toBe('high')
  })

  it('agent override beats session-stored effort and model default', () => {
    expect(
      resolveEffectiveEffort({
        session: { providerReasoningEffort: 'low' },
        agentOverrideEffort: 'max',
        modelDefaultEffort: 'medium',
      }),
    ).toBe('max')
  })

  it('session-stored effort beats model default', () => {
    expect(
      resolveEffectiveEffort({
        session: { providerReasoningEffort: 'low' },
        modelDefaultEffort: 'medium',
      }),
    ).toBe('low')
  })

  it('falls back to the model default when nothing explicit is set', () => {
    expect(resolveEffectiveEffort({ session: null, modelDefaultEffort: 'medium' })).toBe('medium')
  })

  it('returns undefined when nothing is set at all', () => {
    expect(resolveEffectiveEffort({ session: null })).toBeUndefined()
  })
})

describe('shouldGateEffortChange', () => {
  it('gates a differing effort on a warm cache', () => {
    expect(shouldGateEffortChange({ warmCache: true, currentEffort: 'max', proposedEffort: 'none' })).toBe(true)
  })

  it('does not gate when the effort is unchanged', () => {
    expect(shouldGateEffortChange({ warmCache: true, currentEffort: 'max', proposedEffort: 'max' })).toBe(false)
  })

  it('does not gate without a warm cache (fresh session)', () => {
    expect(shouldGateEffortChange({ warmCache: false, currentEffort: 'max', proposedEffort: 'none' })).toBe(false)
    expect(shouldGateEffortChange({ currentEffort: 'max', proposedEffort: 'none' })).toBe(false)
  })

  it('does not gate when there is no proposed effort', () => {
    expect(shouldGateEffortChange({ warmCache: true, currentEffort: 'max' })).toBe(false)
  })

  it('does not gate when there is no current effort to preserve (Keep would be a no-op)', () => {
    expect(shouldGateEffortChange({ warmCache: true, proposedEffort: 'max' })).toBe(false)
    expect(shouldGateEffortChange({ warmCache: true, currentEffort: undefined, proposedEffort: 'max' })).toBe(false)
  })
})

describe('resolveWorkflowFirstAgentId', () => {
  const workflow = {
    entryStep: 'plan',
    steps: [
      { id: 'plan', name: 'Plan', type: 'agent', agentId: 'planner', phase: 'build', transitions: [] },
      {
        id: 'verify',
        name: 'Verify',
        type: 'sub_agent',
        subAgentType: 'verifier',
        phase: 'verification',
        transitions: [],
      },
      { id: 'shell', name: 'Shell', type: 'shell', phase: 'build', transitions: [] },
    ],
  }

  it('returns the agentId of the entry agent step', () => {
    expect(resolveWorkflowFirstAgentId(workflow)).toBe('planner')
  })

  it('returns the subAgentType when the entry step is a sub_agent', () => {
    const wf = { ...workflow, entryStep: 'verify' }
    expect(resolveWorkflowFirstAgentId(wf)).toBe('verifier')
  })

  it('returns undefined for shell/user entry steps', () => {
    const wf = { ...workflow, entryStep: 'shell' }
    expect(resolveWorkflowFirstAgentId(wf)).toBeUndefined()
  })

  it('resolves the first step of the launched sub-group slice', () => {
    const wf = {
      entryStep: 'plan',
      steps: [
        ...workflow.steps,
        { id: 's2', name: 'S2', type: 'agent', agentId: 'builder', phase: 'build', transitions: [], subGroup: 'g' },
      ],
    }
    expect(resolveWorkflowFirstAgentId(wf, 'g')).toBe('builder')
  })

  it('falls back to the entry step when the sub-group has no steps', () => {
    expect(resolveWorkflowFirstAgentId(workflow, 'missing')).toBe('planner')
  })
})
