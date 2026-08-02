import { useConfigStore } from '../stores/config'

export function useWorkdir(): string | null {
  return useConfigStore((s) => s.workdir)
}
