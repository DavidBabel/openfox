// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkflowsStore } from '../../stores/workflows'
import { useAgentsStore } from '../../stores/agents'
import { WorkflowsModal } from './WorkflowsModal'

const reviewUser = {
  id: 'review',
  name: 'PR Review (Global)',
  description: '',
  version: '1.0.0',
  color: '#10b981',
  scope: 'user' as const,
}
const reviewProject = {
  id: 'review',
  name: 'PR Review (Project)',
  description: '',
  version: '1.0.0',
  color: '#10b981',
  scope: 'project' as const,
}

function deleteConfirmButton(): HTMLButtonElement {
  // ConfirmButton's Delete has visible text; DeleteIcon has only a title.
  return screen
    .getAllByRole('button')
    .find((b) => b.textContent === 'Delete' && !b.hasAttribute('title')) as HTMLButtonElement
}

describe('WorkflowsModal confirm-delete scoping', () => {
  afterEach(cleanup)

  beforeEach(() => {
    useAgentsStore.setState({ defaults: [], userItems: [], projectItems: [], loading: false })
    useWorkflowsStore.setState({
      defaults: [],
      userItems: [reviewUser],
      projectItems: [reviewProject],
      loading: false,
      activeWorkflowId: 'default',
      templateVariables: [],
      fetchWorkflows: vi.fn(async () => undefined),
      fetchTemplateVariables: vi.fn(async () => undefined),
      fetchWorkflow: vi.fn(async () => null),
      fetchDefaultContent: vi.fn(async () => null),
      createWorkflow: vi.fn(async () => ({ success: true })),
      updateWorkflow: vi.fn(async () => ({ success: true })),
      deleteWorkflow: vi.fn(async () => ({ success: true })),
      duplicateWorkflow: vi.fn(async () => ({ success: true })),
    })
  })

  it('confirms delete on one same-id row without confirming the sibling scope', async () => {
    const deleteWorkflow = vi.fn(async () => ({ success: true }))
    useWorkflowsStore.setState({ deleteWorkflow })
    useAgentsStore.setState({ fetchAgents: vi.fn(async () => undefined) })

    render(<WorkflowsModal isOpen onClose={vi.fn()} />)

    // Two rows share the id "review" (Custom + Project), each with its own trash icon.
    const trashButtons = screen.getAllByTitle('Delete')
    expect(trashButtons.length).toBe(2)
    expect(screen.getByText('PR Review (Global)')).toBeDefined()
    expect(screen.getByText('PR Review (Project)')).toBeDefined()

    fireEvent.click(trashButtons[0]!)

    // Only the Custom row enters confirm state; the Project row keeps its trash icon.
    expect(screen.getAllByTitle('Delete').length).toBe(1)
    const confirm = deleteConfirmButton()
    expect(confirm).toBeDefined()
    expect(deleteWorkflow).not.toHaveBeenCalled()

    fireEvent.click(confirm)

    await vi.waitFor(() => {
      expect(deleteWorkflow).toHaveBeenCalledWith('review', 'user', undefined)
    })
  })

  it('confirms delete on the project row with the project scope', async () => {
    const deleteWorkflow = vi.fn(async () => ({ success: true }))
    useWorkflowsStore.setState({ deleteWorkflow })
    useAgentsStore.setState({ fetchAgents: vi.fn(async () => undefined) })

    render(<WorkflowsModal isOpen onClose={vi.fn()} />)

    const trashButtons = screen.getAllByTitle('Delete')
    expect(trashButtons.length).toBe(2)
    fireEvent.click(trashButtons[1]!)

    expect(screen.getAllByTitle('Delete').length).toBe(1)
    fireEvent.click(deleteConfirmButton())

    await vi.waitFor(() => {
      expect(deleteWorkflow).toHaveBeenCalledWith('review', 'project', undefined)
    })
  })
})
