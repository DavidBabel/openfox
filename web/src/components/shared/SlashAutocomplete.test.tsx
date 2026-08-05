// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SlashAutocomplete } from './SlashAutocomplete'
import type { WorkflowInfo } from '../../lib/parse-slash-command'
import type { CommandInfo } from '../../lib/parse-slash-command'

const workflows: WorkflowInfo[] = [
  {
    id: 'review',
    name: 'PR Review',
    scope: 'user',
    parameters: [{ id: 'pr_number', label: 'PR Number', position: 0 }],
  },
  { id: 'review', name: 'PR Review', scope: 'project' },
  { id: 'deploy', name: 'Deploy', scope: 'builtin' },
]

const commands: CommandInfo[] = [
  { id: 'summarize', name: 'Summarize' },
  { id: 'greet', name: 'Greet' },
]

function renderAutocomplete(
  text: string,
  cursorPos: number,
  overrides: { workflows?: WorkflowInfo[]; commands?: CommandInfo[] } = {},
) {
  return render(
    <SlashAutocomplete
      text={text}
      cursorPos={cursorPos}
      workflows={overrides.workflows ?? workflows}
      commands={overrides.commands ?? commands}
      onSelect={vi.fn()}
    />,
  )
}

describe('SlashAutocomplete', () => {
  afterEach(() => cleanup())

  it('renders nothing when no slash at cursor', () => {
    const { container } = renderAutocomplete('hello', 5)
    expect(container.innerHTML).toBe('')
  })

  it('renders matching workflows and commands', () => {
    renderAutocomplete('/rev', 4)
    expect(screen.getAllByText('/review')).toHaveLength(2)
    expect(screen.getAllByText('PR Review')).toHaveLength(2)
    // Should not show non-matching items
    expect(screen.queryByText('/deploy')).toBeNull()
    expect(screen.queryByText('/summarize')).toBeNull()
  })

  it('shows a scope badge for every workflow entry', () => {
    renderAutocomplete('/rev', 4)
    expect(screen.getByText('Global')).toBeDefined()
    expect(screen.getByText('Project')).toBeDefined()
  })

  it('does not tag command entries with a scope badge', () => {
    renderAutocomplete('/sum', 4)
    expect(screen.queryByText('Global')).toBeNull()
    expect(screen.queryByText('Project')).toBeNull()
  })

  it('shows param count badge for parameterized items', () => {
    const { container } = renderAutocomplete('/rev', 4)
    const badges = container.querySelectorAll('[class*="rounded"]')
    const paramBadge = Array.from(badges).find((b) => b.textContent === '1 param')
    expect(paramBadge).toBeDefined()
  })

  it('matches by name too', () => {
    renderAutocomplete('/dep', 4)
    expect(screen.getByText('/deploy')).toBeDefined()
  })

  it('matches commands', () => {
    renderAutocomplete('/sum', 4)
    expect(screen.getByText('/summarize')).toBeDefined()
  })

  it('carries the scope on selected workflow suggestions', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <SlashAutocomplete
        text="/rev"
        cursorPos={4}
        workflows={[{ id: 'review', name: 'PR Review', scope: 'project' }]}
        commands={[]}
        onSelect={onSelect}
      />,
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    fireEvent.click(buttons[0]!)
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'review', type: 'workflow', scope: 'project' }),
      0,
    )
  })
})
