// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SlashAutocomplete } from './SlashAutocomplete'
import type { WorkflowInfo } from '../../lib/parse-slash-command'
import type { CommandInfo } from '../../lib/parse-slash-command'

const workflows: WorkflowInfo[] = [
  { id: 'review', name: 'PR Review', parameters: [{ id: 'pr_number', label: 'PR Number', position: 0 }] },
  { id: 'deploy', name: 'Deploy' },
]

const commands: CommandInfo[] = [
  { id: 'summarize', name: 'Summarize' },
  { id: 'greet', name: 'Greet' },
]

function renderAutocomplete(text: string, cursorPos: number) {
  return render(
    <SlashAutocomplete
      text={text}
      cursorPos={cursorPos}
      workflows={workflows}
      commands={commands}
      onSelect={vi.fn()}
    />,
  )
}

describe('SlashAutocomplete', () => {
  it('renders nothing when no slash at cursor', () => {
    const { container } = renderAutocomplete('hello', 5)
    expect(container.innerHTML).toBe('')
  })

  it('renders matching workflows and commands', () => {
    renderAutocomplete('/rev', 4)
    expect(screen.getByText('/review')).toBeDefined()
    expect(screen.getByText('PR Review')).toBeDefined()
    // Should not show non-matching items
    expect(screen.queryByText('/deploy')).toBeNull()
    expect(screen.queryByText('/summarize')).toBeNull()
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

  it('calls onSelect on click', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <SlashAutocomplete text="/rev" cursorPos={4} workflows={workflows} commands={commands} onSelect={onSelect} />,
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThan(0)
    fireEvent.click(buttons[0]!)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'review', type: 'workflow' }), 0)
  })
})
