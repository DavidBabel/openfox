import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react'
import { load, release, retain, snapshot, subscribe, type Resource } from '../lib/resourceCache'

/**
 * React binding over the resource cache. Loadership is implicit: mounting the
 * hook kicks `load()` + `retain()` in a layout effect (before first paint, so
 * there is no "loaded-but-empty" flash frame) and cleanup releases the ref.
 * `refresh()` is stable per args and swallows errors into the snapshot.
 */
export function useResource<Data, Args extends unknown[]>(res: Resource<Data, Args>, ...args: Args) {
  const key = res.keyOf(...args)
  const getSnapshot = useCallback(() => snapshot<Data>(key), [key])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const refresh = useCallback(() => res.refresh(...args), [res, ...args])

  useLayoutEffect(() => {
    load(key, () => res.fetch(...args), res.maxAgeMs)
    retain(key)
    return () => release(key)
  }, [key, res, ...args])

  return { ...state, refresh }
}
