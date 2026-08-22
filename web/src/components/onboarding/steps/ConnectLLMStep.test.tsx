// @vitest-environment happy-dom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { ConnectLLMStep, type ConnectLLMStepHandle } from './ConnectLLMStep'

vi.mock('../../shared/ProviderModal', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react')
  return {
    ProviderModal: ({ onSave }: any) =>
      React.createElement(
        'button',
        {
          'data-testid': 'mock-provider-modal-save',
          onClick: () =>
            onSave({
              id: 'temp-1',
              name: 'Test Provider',
              url: 'http://localhost:8000',
              backend: 'unknown',
              isLocal: false,
              models: [],
            }),
        },
        'save provider',
      ),
    providerFormPayload: (data: any) => data,
  }
})

vi.mock('../../../lib/api', () => ({
  authFetch: vi.fn(async (url: string, init?: any) => {
    if (url === '/api/providers' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ provider: { id: 'provider-1' } }) }
    }
    return { ok: true, json: async () => ({ providers: [] }) }
  }),
}))

afterEach(() => {
  cleanup()
})

describe('ConnectLLMStep', () => {
  it('[AUTOMATED] embedded mode: no onboarding chrome, host-driven footer, no auto-advance on first add', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    const ref = createRef<ConnectLLMStepHandle>()
    render(<ConnectLLMStep ref={ref} onNext={onNext} embedded />)

    // Onboarding chrome and body CTAs are the host's responsibility when embedded
    expect(screen.queryByText('LLM Providers')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Add Provider' })).toBeNull()

    // Adding the first provider does not auto-advance/close
    act(() => ref.current!.addProvider())
    expect(screen.getByTestId('mock-provider-modal-save')).toBeDefined()
    await user.click(screen.getByTestId('mock-provider-modal-save'))

    expect(onNext).not.toHaveBeenCalled()
    expect(screen.getByText('Test Provider')).toBeDefined()

    // The host's "Done" maps to submit
    act(() => ref.current!.submit())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('[AUTOMATED] wizard mode: adding the first provider advances via onNext and the CTA reads Continue', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ConnectLLMStep onNext={onNext} />)

    expect(screen.getByText('LLM Providers')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDefined()

    await user.click(screen.getByText('Add Provider'))
    await user.click(screen.getByTestId('mock-provider-modal-save'))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(onNext).toHaveBeenCalledWith({
      providers: [expect.objectContaining({ id: 'provider-1', name: 'Test Provider' })],
    })
  })
})
