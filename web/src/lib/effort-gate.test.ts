import { describe, expect, it } from 'vitest'
import {
  resolveEffectiveEffort,
  shouldGateEffortChange,
  resolveWorkflowFirstAgentId,
  resolveDisplayEffort,
} from './effort-gate'

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

  it('ignores a non-vocabulary model default (custom thinkingLevel) — nothing storable to keep', () => {
    expect(resolveEffectiveEffort({ session: null, modelDefaultEffort: 'turbo' })).toBeUndefined()
  })

  it('an active manual pick with a non-vocabulary model default resolves to undefined', () => {
    expect(
      resolveEffectiveEffort({
        session: {
          providerReasoningEffort: null,
          providerPinnedEffort: 'high',
          providerManual: true,
          providerManualActive: true,
        },
        modelDefaultEffort: 'turbo',
      }),
    ).toBeUndefined()
  })

  it('a non-vocabulary override falls through to nothing even when nothing explicit is set', () => {
    expect(resolveEffectiveEffort({ session: { providerReasoningEffort: null }, modelDefaultEffort: 'custom' })).toBe(
      undefined,
    )
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

  it('does not gate when the current effort is not a storable vocabulary value (custom thinkingLevel/override)', () => {
    expect(shouldGateEffortChange({ warmCache: true, currentEffort: 'turbo', proposedEffort: 'high' })).toBe(false)
  })

  it('gates vocabulary efforts normally even when a model override exists', () => {
    expect(shouldGateEffortChange({ warmCache: true, currentEffort: 'medium', proposedEffort: 'high' })).toBe(true)
  })
})

describe('resolveDisplayEffort', () => {
  it('shows the explicit effort when it is in the model preset list', () => {
    expect(
      resolveDisplayEffort({
        explicitEffort: 'high',
        reasoningEfforts: ['low', 'medium', 'high'],
        thinkingEnabled: true,
        thinkingLevel: 'medium',
      }),
    ).toBe('high')
  })

  it('clamps an out-of-list explicit effort to the sent value (first advertised)', () => {
    expect(resolveDisplayEffort({ explicitEffort: 'max', reasoningEfforts: ['low', 'medium', 'high'] })).toBe('low')
  })

  it('clamps an out-of-list explicit effort to the advertised default', () => {
    expect(
      resolveDisplayEffort({
        explicitEffort: 'max',
        reasoningEfforts: ['low', 'medium', 'high'],
        thinkingEnabled: true,
        thinkingLevel: 'high',
      }),
    ).toBe('high')
  })

  it('shows the override verbatim when no explicit effort is set', () => {
    expect(resolveDisplayEffort({ reasoningEfforts: ['low', 'medium', 'high'], override: 'deep' })).toBe('deep')
  })

  it('does not show a thinkingLevel default the model does not advertise (it would be dropped)', () => {
    expect(
      resolveDisplayEffort({ reasoningEfforts: ['low', 'high'], thinkingEnabled: true, thinkingLevel: 'turbo' }),
    ).toBeUndefined()
  })

  it('shows the thinkingLevel default when advertised', () => {
    expect(
      resolveDisplayEffort({
        reasoningEfforts: ['low', 'medium', 'high'],
        thinkingEnabled: true,
        thinkingLevel: 'medium',
      }),
    ).toBe('medium')
  })

  it('without a preset list the explicit effort or override passes through', () => {
    expect(resolveDisplayEffort({ explicitEffort: 'max' })).toBe('max')
    expect(resolveDisplayEffort({ override: 'deep' })).toBe('deep')
    expect(resolveDisplayEffort({})).toBeUndefined()
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
