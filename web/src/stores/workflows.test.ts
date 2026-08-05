// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useWorkflowsStore, selectAllWorkflows, useAllWorkflows, type WorkflowInfo } from './workflows'

function workflow(id: string, scope: WorkflowInfo['scope']): WorkflowInfo {
  return { id, name: id, description: '', version: '1', scope }
}

describe('useAllWorkflows', () => {
  beforeEach(() => {
    useWorkflowsStore.setState({
      defaults: [workflow('builtin', 'builtin')],
      userItems: [workflow('mine', 'user')],
      projectItems: [workflow('ours', 'project')],
    })
  })

  it('returns a stable snapshot across re-renders while the lists are unchanged', () => {
    const { result } = renderHook(() => useAllWorkflows())
    const first = result.current
    act(() => {})
    expect(result.current).toBe(first)
  })

  it('flattens workflows from every scope', () => {
    const { result } = renderHook(() => useAllWorkflows())
    expect(result.current.map((w) => w.id)).toEqual(['builtin', 'mine', 'ours'])
  })

  it('produces a new snapshot only when an underlying list changes', () => {
    const { result } = renderHook(() => useAllWorkflows())
    const first = result.current
    act(() => {
      useWorkflowsStore.setState({ userItems: [workflow('mine-v2', 'user'), workflow('extra', 'user')] })
    })
    expect(result.current).not.toBe(first)
    expect(result.current.map((w) => w.id)).toEqual(['builtin', 'mine-v2', 'extra', 'ours'])
  })
})

describe('selectAllWorkflows', () => {
  it('always builds a fresh array (must go through useAllWorkflows as a hook selector)', () => {
    const state = useWorkflowsStore.getState()
    expect(selectAllWorkflows(state)).not.toBe(selectAllWorkflows(state))
  })
})
