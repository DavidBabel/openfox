// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GRACE_MS, clearCache, resource } from '../lib/resourceCache'
import { useResource } from './useResource'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function makeResource(maxAgeMs = 0) {
  const fetch = vi.fn(async () => 'loaded')
  const res = resource<string, []>({ key: () => 'test:key', fetch, maxAgeMs })
  return { fetch, res }
}

describe('useResource', () => {
  beforeEach(() => {
    clearCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mounts loading, populates data, and releases on unmount (evicted after grace)', async () => {
    const { fetch, res } = makeResource()
    const { result, unmount } = renderHook(() => useResource(res))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeUndefined()

    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBe('loaded')
    expect(fetch).toHaveBeenCalledTimes(1)

    unmount()
    vi.advanceTimersByTime(GRACE_MS + 1_000)

    const second = renderHook(() => useResource(res))
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    second.unmount()
  })

  it('does not refetch on a quick remount within the freshness window', async () => {
    const { fetch, res } = makeResource(60_000)
    const first = renderHook(() => useResource(res))
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(fetch).toHaveBeenCalledTimes(1)

    first.unmount()

    const second = renderHook(() => useResource(res))
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(second.result.current.data).toBe('loaded')
    second.unmount()
  })

  it('keeps distinct scopes isolated and reloads when the scope changes', async () => {
    const fetch = vi.fn(async (id: string) => `data-${id}`)
    const res = resource<string, [string]>({ key: (id) => `test:${id}`, fetch })
    const { result, rerender } = renderHook(({ id }) => useResource(res, id), { initialProps: { id: 'a' } })

    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(result.current.data).toBe('data-a')

    rerender({ id: 'b' })
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.current.data).toBe('data-b')
  })
})
