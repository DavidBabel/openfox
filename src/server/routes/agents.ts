import {
  loadDefaultAgents,
  loadUserAgents,
  loadProjectAgents,
  loadAllAgents,
  findAgentById,
  saveAgent,
  saveAgentToProject,
  deleteAgent,
  deleteProjectAgent,
  agentExists,
  isDefaultAgent,
  getDefaultAgentIds,
} from '../agents/registry.js'
import type { AgentDefinition } from '../agents/types.js'
import { createCrudRoutes, type CrudRouteConfig } from './crud-helpers.js'
import { getAgentModelOverride, setAgentModelOverride, getAgentModelOverrides } from '../agents/model-overrides.js'
import { logger } from '../utils/logger.js'

// Pre-load default agent IDs at module init for fast synchronous validation.
// In practice the server is fully initialized before accepting requests,
// so this cache is populated by the time any POST arrives.
let defaultAgentIds: string[] = []
getDefaultAgentIds()
  .then((ids) => {
    defaultAgentIds = ids
  })
  .catch((err) => {
    logger.debug('Failed to pre-load default agent IDs', { error: err instanceof Error ? err.message : String(err) })
  })

const config: CrudRouteConfig<AgentDefinition> = {
  dirName: 'agents',
  ext: '.agent.md',
  loadDefaults: loadDefaultAgents,
  loadUser: loadUserAgents,
  loadProject: loadProjectAgents,
  loadAll: loadAllAgents,
  findById: findAgentById,
  save: saveAgent,
  saveToProject: saveAgentToProject,
  delete: deleteAgent,
  deleteProject: deleteProjectAgent,
  exists: agentExists,
  isDefault: isDefaultAgent,
  getDefaultIds: getDefaultAgentIds,
  validateCreate: (body) => {
    const meta = body['metadata'] as Record<string, unknown> | undefined
    if (!meta?.['id'] || !body['prompt']) return 'Missing required fields: metadata.id, prompt'
    const id = String(meta['id'])
    if (defaultAgentIds.includes(id)) {
      return `ID "${id}" conflicts with a built-in agent. Use a different ID.`
    }
    return null
  },
  mapToResponse: (a) => a.metadata as unknown as { [key: string]: unknown },
  extraGetData: async () => {
    const overrides = getAgentModelOverrides()
    // Convert { agentId: { providerId, model } } to { agentId: "providerId/model" }
    const modelOverrides: Record<string, string> = {}
    for (const [agentId, override] of Object.entries(overrides)) {
      modelOverrides[agentId] = `${override.providerId}/${override.model}`
    }
    return { modelOverrides }
  },
  extraRoutes: (router) => {
    // Agent model override endpoints (stored in DB settings, not in .agent.md)
    router.get('/:id/model', (req, res) => {
      const { id } = req.params
      const override = getAgentModelOverride(id)
      res.json(override ?? { providerId: null, model: null })
    })

    router.put('/:id/model', (req, res) => {
      const { id } = req.params
      const { providerId, model } = req.body as { providerId?: string; model?: string }
      if (providerId && model) {
        setAgentModelOverride(id, { providerId, model })
      } else {
        setAgentModelOverride(id, null)
      }
      res.json({ success: true })
    })

    router.delete('/:id/model', (req, res) => {
      const { id } = req.params
      setAgentModelOverride(id, null)
      res.json({ success: true })
    })
  },
}

export function createAgentRoutes(configDir: string, projectDir?: string) {
  return createCrudRoutes<AgentDefinition>(config, configDir, projectDir)
}
