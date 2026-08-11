// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SessionPane } from './SessionPane'

let storeState: Record<string, unknown> = {}

vi.mock('../../stores/session', () => ({
  useSessionStore: (selector: (state: unknown) => unknown) => selector(storeState),
}))

vi.mock('../../stores/project', () => ({
  useProjectStore: (selector: (state: unknown) => unknown) => selector({ projects: [{ id: 'p1', name: 'acme-app' }] }),
}))

const planPanelProps = { sessionId: '', criteriaSidebarOpen: true }
vi.mock('../plan/PlanPanel', () => ({
  PlanPanel: (props: { sessionId: string; criteriaSidebarOpen: boolean }) => {
    planPanelProps.sessionId = props.sessionId
    planPanelProps.criteriaSidebarOpen = props.criteriaSidebarOpen
    return <div data-testid="plan-panel" />
  },
}))

function makePane(id: string, overrides: Record<string, unknown> = {}) {
  return {
    session: { id, projectId: 'p1', metadata: { title: 'Auth refactor' }, isRunning: true, phase: 'build' },
    messages: [],
    hiddenCount: 0,
    currentTodos: [],
    pendingPathConfirmations: [],
    pendingQuestions: [],
    ...overrides,
  }
}

const props = {
  sessionId: 's1',
  focused: false,
  onFocus: vi.fn(),
  onClose: vi.fn(),
}

describe('SessionPane', () => {
  beforeEach(() => {
    storeState = { panes: { s1: makePane('s1') } }
    planPanelProps.sessionId = ''
    planPanelProps.criteriaSidebarOpen = false
    props.onFocus.mockClear()
    props.onClose.mockClear()
  })

  afterEach(() => cleanup())

  it('renders project tag, title and the full feed panel', () => {
    render(<SessionPane {...props} />)
    expect(screen.getByText('acme-app')).toBeDefined()
    expect(screen.getByText('Auth refactor')).toBeDefined()
    expect(screen.getByTestId('plan-panel')).toBeDefined()
    // Legacy phase labels are not part of the pane header
    expect(screen.queryByText('Build')).toBeNull()
  })

  it('merges extra classes onto the pane root (flex sizing in columns mode)', () => {
    render(<SessionPane {...props} className="flex-1" />)
    const root = document.querySelector('[data-split-pane="s1"]')
    expect(root?.className).toContain('flex-1')
  })

  it('renders attention badges for pending confirmations and questions', () => {
    storeState.panes = {
      s1: makePane('s1', { pendingPathConfirmations: [{ callId: 'c1' }], pendingQuestions: [{ callId: 'q1' }] }),
    }
    render(<SessionPane {...props} />)
    expect(screen.getByTitle('1 question · 1 confirmation')).toBeDefined()
  })

  it('mounts the pane root as a container so breakpoints apply per pane', () => {
    render(<SessionPane {...props} />)
    const root = document.querySelector('[data-split-pane="s1"]')
    expect(root?.className).toContain('@container')
  })

  it('feeds the scoped session and criteria state into the PlanPanel', () => {
    render(<SessionPane {...props} />)
    expect(planPanelProps.sessionId).toBe('s1')
    // Narrow panes (0px in jsdom) start with the criteria sidebar closed
    expect(planPanelProps.criteriaSidebarOpen).toBe(false)
  })

  it('toggles the per-pane criteria sidebar independently', () => {
    render(<SessionPane {...props} />)
    fireEvent.click(screen.getByLabelText('Show criteria sidebar'))
    expect(planPanelProps.criteriaSidebarOpen).toBe(true)
    fireEvent.click(screen.getByLabelText('Hide criteria sidebar'))
    expect(planPanelProps.criteriaSidebarOpen).toBe(false)
  })

  it('fires close and focus actions', () => {
    render(<SessionPane {...props} />)
    fireEvent.click(screen.getByLabelText('Close pane'))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('marks the pane as focused', () => {
    render(<SessionPane {...props} focused={true} />)
    expect(document.querySelector('[data-focused="true"]')).not.toBeNull()
  })
})
