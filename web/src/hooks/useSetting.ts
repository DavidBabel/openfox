import { useResource } from './useResource'
import { settingResource } from '../lib/resources'

/**
 * Read one server-persisted setting with implicit loadership. `fallback` covers
 * the not-yet-loaded window and the case where the server has no value.
 */
export function useSetting(key: string, fallback = '') {
  const { data, loading } = useResource(settingResource, key)
  return { value: data ?? fallback, loading }
}
