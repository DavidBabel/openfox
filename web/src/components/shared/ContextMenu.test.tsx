// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ContextMenu, type ContextMenuItem } from './ContextMenu'

afterEach(() => {
  cleanup()
})

describe('ContextMenu', () => {
  it('renders info items as static text (not buttons)', () => {
    const items: ContextMenuItem[] = [
      { label: '2026/08/16 14:44', info: true },
      { label: 'Copy', onClick: vi.fn() },
    ]
    render(<ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={vi.fn()} />)

    expect(screen.getByText('2026/08/16 14:44')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    // Info item is informational, not interactive.
    expect(screen.queryByRole('button', { name: '2026/08/16 14:44' })).toBeNull()
  })

  it('does not close the menu when clicking an info item', () => {
    const onClose = vi.fn()
    const items: ContextMenuItem[] = [
      { label: '2026/08/16 14:44', info: true },
      { label: 'Copy', onClick: vi.fn() },
    ]
    render(<ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={onClose} />)

    fireEvent.click(screen.getByText('2026/08/16 14:44'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('executes the action and closes the menu when clicking an action item', () => {
    const onClose = vi.fn()
    const onClick = vi.fn()
    const items: ContextMenuItem[] = [
      { label: '2026/08/16 14:44', info: true },
      { label: 'Copy', onClick },
    ]
    render(<ContextMenu items={items} position={{ x: 10, y: 10 }} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
