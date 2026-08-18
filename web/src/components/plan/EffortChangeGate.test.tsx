// @vitest-environment happy-dom
import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EffortChangeGateProvider, useEffortChangeGate, type EffortGateInfo } from './EffortChangeGate'

function GateProbe({ info }: { info: EffortGateInfo }) {
  const { requestEffortSwitch } = useEffortChangeGate()
  return (
    <button
      type="button"
      onClick={() => {
        void requestEffortSwitch(info)
      }}
    >
      request
    </button>
  )
}

describe('EffortChangeGate', () => {
  afterEach(() => {
    cleanup()
    document.body.innerHTML = ''
  })

  it('shows the modal with the target effort, current effort, and a hedged cache warning', async () => {
    const user = userEvent.setup()
    render(
      <EffortChangeGateProvider>
        <GateProbe info={{ fromEffort: 'high', toEffort: 'max', contextLabel: 'Explorer' }} />
      </EffortChangeGateProvider>,
    )
    await user.click(screen.getByText('request'))

    expect(screen.getByText('Reasoning effort change')).toBeTruthy()
    expect(document.body.textContent).toContain('Explorer')
    expect(document.body.textContent).toContain('max')
    expect(document.body.textContent).toContain('high')
    // The cache impact is hedged ("may"): it is real for local backends that
    // template reasoning_effort into the system prompt, not for every provider.
    expect(document.body.textContent).toContain('may invalidate the LLM prefix cache')
    expect(document.body.textContent).toContain('if it does, the next response will take longer')
  })

  it('resolves with "keep" when the keep button is clicked', async () => {
    const user = userEvent.setup()
    let resolved: string | null = null
    function Probe() {
      const { requestEffortSwitch } = useEffortChangeGate()
      return (
        <button
          type="button"
          onClick={() => {
            void requestEffortSwitch({ toEffort: 'max', fromEffort: 'high' }).then((c) => {
              resolved = c
            })
          }}
        >
          request
        </button>
      )
    }
    render(
      <EffortChangeGateProvider>
        <Probe />
      </EffortChangeGateProvider>,
    )
    await user.click(screen.getByText('request'))
    await user.click(screen.getByText('Keep current reasoning effort'))
    await waitFor(() => expect(resolved).toBe('keep'))
  })

  it('resolves with "apply" via the apply button', async () => {
    const user = userEvent.setup()
    let resolved: string | null = null
    function Probe() {
      const { requestEffortSwitch } = useEffortChangeGate()
      return (
        <button
          type="button"
          onClick={() => {
            void requestEffortSwitch({ toEffort: 'max', fromEffort: 'high' }).then((c) => {
              resolved = c
            })
          }}
        >
          request
        </button>
      )
    }
    render(
      <EffortChangeGateProvider>
        <Probe />
      </EffortChangeGateProvider>,
    )
    await user.click(screen.getByText('request'))
    await user.click(screen.getByText('Apply the reasoning effort (invalidates cache)'))
    await waitFor(() => expect(resolved).toBe('apply'))
  })

  it('omits the current effort clause when no fromEffort is given', async () => {
    const user = userEvent.setup()
    render(
      <EffortChangeGateProvider>
        <GateProbe info={{ toEffort: 'low' }} />
      </EffortChangeGateProvider>,
    )
    await user.click(screen.getByText('request'))
    expect(document.body.textContent).not.toContain('(currently')
  })

  it('supports multiple sequential requests (state resets after a choice)', async () => {
    const user = userEvent.setup()
    const resolved: string[] = []
    function Probe() {
      const { requestEffortSwitch } = useEffortChangeGate()
      return (
        <button
          type="button"
          onClick={() => {
            void requestEffortSwitch({ toEffort: 'max', fromEffort: 'high' }).then((c) => {
              resolved.push(c)
            })
          }}
        >
          request
        </button>
      )
    }
    render(
      <EffortChangeGateProvider>
        <Probe />
      </EffortChangeGateProvider>,
    )
    await user.click(screen.getByText('request'))
    await user.click(screen.getByText('Keep current reasoning effort'))
    await user.click(screen.getByText('request'))
    await user.click(screen.getByText('Apply the reasoning effort (invalidates cache)'))
    await waitFor(() => expect(resolved).toEqual(['keep', 'apply']))
  })

  it('throws when used outside the provider', () => {
    expect(() => render(<GateProbe info={{ toEffort: 'max' }} />)).toThrow(
      'useEffortChangeGate must be used within EffortChangeGateProvider',
    )
  })
})
