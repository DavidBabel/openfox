// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { cleanup, render, screen, act, fireEvent, waitFor } from '@testing-library/react'
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

const { mockProviders, reorderCalls, failReorder } = vi.hoisted(() => ({
  mockProviders: [] as any[],
  reorderCalls: [] as string[][],
  failReorder: { current: false },
}))

vi.mock('../../../lib/api', () => ({
  authFetch: vi.fn(async (url: string, init?: any) => {
    if (url === '/api/providers' && (!init?.method || init.method === 'GET')) {
      return { ok: true, json: async () => ({ providers: mockProviders, activeProviderId: null }) }
    }
    if (url === '/api/providers' && init?.method === 'POST') {
      return { ok: true, json: async () => ({ provider: { id: 'provider-1' } }) }
    }
    if (url === '/api/providers/order' && init?.method === 'PUT') {
      reorderCalls.push(JSON.parse(init.body).providerIds)
      if (failReorder.current) return { ok: false }
      return { ok: true, json: async () => ({ success: true }) }
    }
    return { ok: true, json: async () => ({ providers: [] }) }
  }),
}))

afterEach(() => {
  cleanup()
})

function makeProvider(id: string, name: string) {
  return {
    id,
    name,
    url: `http://localhost/${id}`,
    backend: 'openai',
    model: null,
    apiKey: undefined,
    isLocal: false,
    thinkingField: undefined,
    sendReasoningInMessages: undefined,
    models: [],
  }
}

function getRowIds() {
  return screen
    .getAllByTestId(/^provider-row-/)
    .map((el) => el.getAttribute('data-testid')!.replace('provider-row-', ''))
}

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

  describe('provider reordering (embedded mode)', () => {
    beforeEach(() => {
      mockProviders.length = 0
      reorderCalls.length = 0
      failReorder.current = false
    })

    it('renders reorder controls for each provider in embedded mode', async () => {
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'), makeProvider('p3', 'Gamma'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      expect(await screen.findAllByLabelText('Move up')).toHaveLength(3)
      expect(screen.getAllByLabelText('Move down')).toHaveLength(3)
      expect(screen.getAllByLabelText('Drag to reorder')).toHaveLength(3)
    })

    it('does not render reorder controls in wizard mode', async () => {
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'))
      render(<ConnectLLMStep onNext={vi.fn()} />)

      expect(await screen.findAllByText('Alpha')).toHaveLength(1)
      expect(screen.queryAllByLabelText('Move up')).toHaveLength(0)
      expect(screen.queryAllByLabelText('Move down')).toHaveLength(0)
      expect(screen.queryAllByLabelText('Drag to reorder')).toHaveLength(0)
    })

    it('disables the up arrow for the first provider and the down arrow for the last', async () => {
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      const upButtons = await screen.findAllByLabelText('Move up')
      const downButtons = screen.getAllByLabelText('Move down')

      expect(upButtons[0]).toBeDisabled()
      expect(upButtons[1]).not.toBeDisabled()
      expect(downButtons[0]).not.toBeDisabled()
      expect(downButtons[1]).toBeDisabled()
    })

    it('moves a provider up with the up arrow and persists the order', async () => {
      const user = userEvent.setup()
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'), makeProvider('p3', 'Gamma'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      const upButtons = await screen.findAllByLabelText('Move up')
      await user.click(upButtons[2]!) // move Gamma up once

      expect(getRowIds()).toEqual(['p1', 'p3', 'p2'])
      await waitFor(() => {
        expect(reorderCalls).toEqual([['p1', 'p3', 'p2']])
      })
    })

    it('moves a provider down with the down arrow and persists the order', async () => {
      const user = userEvent.setup()
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'), makeProvider('p3', 'Gamma'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      const downButtons = await screen.findAllByLabelText('Move down')
      await user.click(downButtons[0]!) // move Alpha down once

      expect(getRowIds()).toEqual(['p2', 'p1', 'p3'])
      await waitFor(() => {
        expect(reorderCalls).toEqual([['p2', 'p1', 'p3']])
      })
    })

    it('reorders via drag and drop and persists the order', async () => {
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'), makeProvider('p3', 'Gamma'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      const handles = await screen.findAllByLabelText('Drag to reorder')
      const rows = screen.getAllByTestId(/^provider-row-/)

      fireEvent.dragStart(handles[0]!)
      fireEvent.dragOver(rows[2]!)
      fireEvent.drop(rows[2]!)
      fireEvent.dragEnd(handles[0]!)

      expect(getRowIds()).toEqual(['p2', 'p3', 'p1'])
      await waitFor(() => {
        expect(reorderCalls).toEqual([['p2', 'p3', 'p1']])
      })
    })

    it('debounces rapid reorders into a single persisted request with the final order', async () => {
      const user = userEvent.setup()
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'), makeProvider('p3', 'Gamma'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      const upButtons = await screen.findAllByLabelText('Move up')
      await user.click(upButtons[1]!) // p2 up -> ['p2','p1','p3']
      await user.click(screen.getAllByLabelText('Move up')[2]!) // p3 up -> ['p2','p3','p1']

      expect(getRowIds()).toEqual(['p2', 'p3', 'p1'])
      await waitFor(() => {
        expect(reorderCalls).toEqual([['p2', 'p3', 'p1']])
      })
    })

    it('reverts the local order and shows feedback when persisting the reorder fails', async () => {
      const user = userEvent.setup()
      failReorder.current = true
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      const upButtons = await screen.findAllByLabelText('Move up')
      await user.click(upButtons[1]!) // move Beta up

      await waitFor(() => {
        expect(getRowIds()).toEqual(['p1', 'p2'])
      })
      expect(reorderCalls).toEqual([['p2', 'p1']])
      expect(screen.getByText(/Couldn't save the new provider order/)).toBeDefined()
    })

    it('clears the error feedback on a subsequent successful reorder', async () => {
      const user = userEvent.setup()
      mockProviders.push(makeProvider('p1', 'Alpha'), makeProvider('p2', 'Beta'), makeProvider('p3', 'Gamma'))
      render(<ConnectLLMStep onNext={vi.fn()} embedded />)

      // First reorder fails...
      failReorder.current = true
      const upButtons = await screen.findAllByLabelText('Move up')
      await user.click(upButtons[2]!)
      await waitFor(() => {
        expect(screen.getByText(/Couldn't save the new provider order/)).toBeDefined()
      })

      // ...then a later reorder succeeds and clears the notice.
      failReorder.current = false
      await user.click(screen.getAllByLabelText('Move down')[1]!)
      await waitFor(() => {
        expect(screen.queryByText(/Couldn't save the new provider order/)).toBeNull()
      })
      await waitFor(() => {
        expect(reorderCalls).toHaveLength(2)
      })
    })
  })
})
