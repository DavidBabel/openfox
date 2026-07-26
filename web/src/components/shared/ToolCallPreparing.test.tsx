// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ToolCallPreparing } from './ToolCallPreparing'

afterEach(cleanup)

describe('ToolCallPreparing remote execution', () => {
  it('frames remote SSH commands with purple border', () => {
    const { container } = render(<ToolCallPreparing name="run_command" arguments={'{"command":"ssh host'} />)

    expect(container.textContent).not.toContain('REMOTE')
    expect(container.firstElementChild?.className).toContain('border-text-thinking')
  })

  it('frames nested remote commands with purple border', () => {
    const { container } = render(
      <ToolCallPreparing name="run_command" arguments={JSON.stringify({ command: "bash -lc 'setsid ssh host'" })} />,
    )

    expect(container.textContent).not.toContain('REMOTE')
    expect(container.firstElementChild?.className).toContain('border-text-thinking')
  })

  it('does not mark local commands as remote', () => {
    const { container } = render(<ToolCallPreparing name="run_command" arguments={'{"command":"echo ssh"'} />)

    expect(container.textContent).not.toContain('REMOTE')
    expect(container.firstElementChild?.className).not.toContain('border-text-thinking')
  })
})
