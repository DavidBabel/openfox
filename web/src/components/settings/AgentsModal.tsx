import { useEffect, useState } from 'react'
import { Modal } from '../shared/SelfContainedModal'
import { useAgentsStore, type AgentFull } from '../../stores/agents'
import { useConfigStore } from '../../stores/config'
import { authFetch } from '../../lib/api'
import { CRUDListHeader, useConfirmDialog, DestinationSelector } from './CRUDModal'
import { AgentGroup } from './agents/AgentListItem'
import { AgentForm } from './agents/AgentForm'
import { ModelPicker } from '../shared/ModelPicker'

interface AgentsModalProps {
  isOpen: boolean
  onClose: () => void
  initialEditId?: string | null
}

function toSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  return slug ? `custom-${slug}` : ''
}

export function AgentsModal({ isOpen, onClose, initialEditId }: AgentsModalProps) {
  const defaults = useAgentsStore((state) => state.defaults)
  const userItems = useAgentsStore((state) => state.userItems)
  const projectItems = useAgentsStore((state) => state.projectItems)
  const loading = useAgentsStore((state) => state.loading)
  const fetchAgents = useAgentsStore((state) => state.fetchAgents)
  const fetchAgent = useAgentsStore((state) => state.fetchAgent)
  const fetchDefaultContent = useAgentsStore((state) => state.fetchDefaultContent)
  const createAgent = useAgentsStore((state) => state.createAgent)
  const updateAgent = useAgentsStore((state) => state.updateAgent)
  const deleteAgentAction = useAgentsStore((state) => state.deleteAgent)

  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isReadOnly, setIsReadOnly] = useState(false)

  const [formName, setFormName] = useState('')
  const [formId, setFormId] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSubagent, setFormSubagent] = useState(true)
  const [formTools, setFormTools] = useState<string[]>([])
  const [formColor, setFormColor] = useState('#6b7280')
  const [formModel, setFormModel] = useState<string | undefined>(undefined)
  const [formPrompt, setFormPrompt] = useState('')
  const [formDestination, setFormDestination] = useState<'project' | 'user'>('user')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingModel, setLoadingModel] = useState(false)

  const [modelModalAgentId, setModelModalAgentId] = useState<string | null>(null)

  const [availableTools, setAvailableTools] = useState<{ name: string; actions: string[]; topLevelOnly?: boolean }[]>(
    [],
  )
  const [alwaysAllowedNames, setAlwaysAllowedNames] = useState<Set<string>>(new Set())
  const { requestDelete, clearConfirm, isConfirming } = useConfirmDialog()

  const populateFormFromAgent = (agent: AgentFull) => {
    setFormName(agent.metadata.name)
    setFormId(agent.metadata.id)
    setFormDescription(agent.metadata.description)
    setFormSubagent(agent.metadata.subagent)
    setFormTools(agent.metadata.allowedTools)
    setFormColor(agent.metadata.color ?? '#6b7280')
    setFormPrompt(agent.prompt)
    setFormError('')
    setLoadingModel(true)
    // Fetch model override
    authFetch(`/api/agents/${agent.metadata.id}/model`)
      .then((r) => r.json())
      .then((data) => {
        if (data.providerId && data.model) {
          setFormModel(`${data.providerId}/${data.model}`)
        } else {
          setFormModel(undefined)
        }
      })
      .catch(() => setFormModel(undefined))
      .finally(() => setLoadingModel(false))
  }

  const applyDuplicateFromContent = (content: AgentFull, id: string, setAsNew: boolean) => {
    setFormName(content.metadata.name + ' (copy)')
    setFormId(`${id}-copy-${Date.now()}`)
    setFormDescription(content.metadata.description)
    setFormSubagent(content.metadata.subagent)
    setFormTools(content.metadata.allowedTools)
    setFormColor(content.metadata.color ?? '#6b7280')
    setFormPrompt(content.prompt)
    setFormError('')
    if (setAsNew) {
      setEditingId(null)
    }
    setIsReadOnly(false)
    setView('edit')
  }

  const applyViewFromContent = (content: AgentFull, id: string) => {
    populateFormFromAgent(content)
    setEditingId(id)
    setIsReadOnly(true)
    setView('edit')
  }

  useEffect(() => {
    if (isOpen) {
      fetchAgents()
      authFetch('/api/tools')
        .then((r) => r.json())
        .then((d) => {
          const tools: { name: string; actions: string[]; alwaysAllowed?: boolean; topLevelOnly?: boolean }[] =
            d.tools || []
          setAlwaysAllowedNames(new Set(tools.filter((t) => t.alwaysAllowed).map((t) => t.name)))
          setAvailableTools(tools.filter((t) => !t.alwaysAllowed))
        })
        .catch(() => {
          setAvailableTools([])
          setAlwaysAllowedNames(new Set())
        })

      if (initialEditId) {
        const isDefault = defaults.some((d) => d.id === initialEditId)
        if (isDefault) {
          fetchDefaultContent(initialEditId).then((content) => {
            if (!content) return
            applyDuplicateFromContent(content, initialEditId, true)
          })
        } else {
          fetchAgent(initialEditId).then((agent) => {
            if (!agent) return
            populateFormFromAgent(agent)
            setEditingId(initialEditId)
            setIsReadOnly(false)
            setView('edit')
          })
        }
      } else {
        setView('list')
        setEditingId(null)
        setIsReadOnly(false)
      }
    }
  }, [isOpen, fetchAgents, fetchAgent, fetchDefaultContent, initialEditId])

  const handleView = async (agentId: string) => {
    const isDefault = defaults.some((d) => d.id === agentId)
    if (isDefault) {
      const content = await fetchDefaultContent(agentId)
      if (!content) return
      applyViewFromContent(content, agentId)
    } else {
      const agent = await fetchAgent(agentId)
      if (!agent) return
      applyViewFromContent(agent, agentId)
    }
  }

  const handleDuplicate = async (agentId: string) => {
    let content = await fetchDefaultContent(agentId)
    if (!content) {
      content = await fetchAgent(agentId)
    }
    if (!content) return
    applyDuplicateFromContent(content, agentId, true)
  }

  const handleNew = () => {
    setEditingId(null)
    setFormName('')
    setFormId('')
    setFormDescription('')
    setFormSubagent(true)
    setFormTools(['read_file'])
    setFormColor('#6b7280')
    setFormPrompt('')
    setFormDestination('user')
    setFormError('')
    setIsReadOnly(false)
    setView('edit')
  }

  const handleEdit = async (agentId: string) => {
    const agent = await fetchAgent(agentId)
    if (!agent) return
    populateFormFromAgent(agent)
    setEditingId(agentId)
    setIsReadOnly(false)
    setView('edit')
  }

  const handleEditBuiltInModel = (agentId: string) => {
    setModelModalAgentId(agentId)
  }

  const handleDelete = async (agentId: string) => {
    await deleteAgentAction(agentId)
  }

  const handleSave = async () => {
    const id = editingId ?? formId
    if (!id || !formName || !formPrompt) {
      setFormError('Name and prompt are required.')
      return
    }

    setSaving(true)
    setFormError('')

    const agent: AgentFull = {
      metadata: {
        id,
        name: formName,
        description: formDescription,
        subagent: formSubagent,
        allowedTools: formTools.filter((t) => !alwaysAllowedNames.has(t)),
        color: formColor,
      },
      prompt: formPrompt,
    }

    const result = editingId ? await updateAgent(editingId, agent) : await createAgent(agent, formDestination)

    if (!result.success) {
      setSaving(false)
      setFormError(result.error ?? 'Failed to save agent.')
      return
    }

    // Save model override separately
    await saveAgentModelOverride(editingId ?? formId, formModel)

    setSaving(false)

    if (initialEditId) onClose()
    else setView('list')
  }

  const handleCancel = () => {
    if (initialEditId) {
      onClose()
    } else {
      setView('list')
      setIsReadOnly(false)
    }
  }

  const handleNameChange = (name: string) => {
    setFormName(name)
    if (!editingId) {
      setFormId(toSlug(name))
    }
  }

  const modelOverrides = useAgentsStore((state) => state.modelOverrides)
  const defaultSubAgents = defaults.filter((a) => a.subagent)
  const defaultTopLevelAgents = defaults.filter((a) => !a.subagent)
  const userSubAgents = userItems.filter((a) => a.subagent)
  const userTopLevelAgents = userItems.filter((a) => !a.subagent)
  const projectSubAgents = projectItems.filter((a) => a.subagent)
  const projectTopLevelAgents = projectItems.filter((a) => !a.subagent)

  if (view === 'edit') {
    return (
      <>
        <Modal
          isOpen={isOpen}
          onClose={handleCancel}
          title={isReadOnly ? `${formName}` : editingId ? 'Edit Agent' : 'New Agent'}
          size="xl"
        >
          {!editingId && !isReadOnly && <DestinationSelector value={formDestination} onChange={setFormDestination} />}
          <AgentForm
            formName={formName}
            formId={formId}
            formDescription={formDescription}
            formSubagent={formSubagent}
            formTools={formTools}
            formColor={formColor}
            formModel={formModel}
            formPrompt={formPrompt}
            formError={formError}
            saving={saving}
            loadingModel={loadingModel}
            isReadOnly={isReadOnly}
            availableTools={availableTools}
            providers={useConfigStore.getState().providers}
            onNameChange={handleNameChange}
            onIdChange={setFormId}
            onDescriptionChange={setFormDescription}
            onSubagentChange={(subagent) => {
              setFormSubagent(subagent)
              if (subagent) {
                setFormTools((prev) => prev.filter((t) => !availableTools.find((at) => at.name === t)?.topLevelOnly))
              }
            }}
            onToolsChange={setFormTools}
            onColorChange={setFormColor}
            onModelChange={setFormModel}
            onPromptChange={setFormPrompt}
            onSave={handleSave}
            onCancel={handleCancel}
            onDuplicate={() => {
              setFormName(formName + ' (copy)')
              setFormId(`${editingId}-copy-${Date.now()}`)
              setEditingId(null)
              setIsReadOnly(false)
            }}
          />
        </Modal>
        <BuiltInModelModal
          agentId={modelModalAgentId}
          onClose={() => setModelModalAgentId(null)}
          onSaved={() => fetchAgents()}
        />
      </>
    )
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Agents" size="lg">
        <CRUDListHeader
          description="Agents define behavior, tools, and prompts for top-level modes and sub-agents."
          onNew={handleNew}
          loading={loading}
          hasItems={defaults.length > 0 || userItems.length > 0 || projectItems.length > 0}
        >
          <div className="space-y-4">
            {defaults.length > 0 && (
              <AgentGroup
                title="Built-in"
                agents={defaultTopLevelAgents}
                subagents={defaultSubAgents}
                isBuiltIn={true}
                alwaysAllowedNames={alwaysAllowedNames}
                modelOverrides={modelOverrides}
                onView={handleView}
                onEdit={handleEditBuiltInModel}
                onDuplicate={handleDuplicate}
              />
            )}

            {[
              { title: 'Custom', agents: userTopLevelAgents, subagents: userSubAgents },
              { title: 'Project', agents: projectTopLevelAgents, subagents: projectSubAgents },
            ].map(
              (section) =>
                section.agents.length > 0 && (
                  <AgentGroup
                    key={section.title}
                    title={section.title}
                    agents={section.agents}
                    subagents={section.subagents}
                    isBuiltIn={false}
                    alwaysAllowedNames={alwaysAllowedNames}
                    modelOverrides={modelOverrides}
                    isConfirmingDelete={(id) => isConfirming(id, 'delete')}
                    onView={handleView}
                    onDuplicate={handleDuplicate}
                    onEdit={handleEdit}
                    onDelete={(id) => {
                      if (isConfirming(id, 'delete')) {
                        handleDelete(id)
                        clearConfirm()
                      } else {
                        requestDelete(id)
                      }
                    }}
                    onCancelDelete={clearConfirm}
                  />
                ),
            )}
          </div>
        </CRUDListHeader>
      </Modal>
      <BuiltInModelModal
        agentId={modelModalAgentId}
        onClose={() => setModelModalAgentId(null)}
        onSaved={() => fetchAgents()}
      />
    </>
  )
}

function parseModelOverride(value: string): { providerId: string; model: string } {
  const slashIndex = value.indexOf('/')
  return slashIndex > 0
    ? { providerId: value.substring(0, slashIndex), model: value.substring(slashIndex + 1) }
    : { providerId: value, model: value }
}

async function saveAgentModelOverride(agentId: string, modelOverride: string | undefined): Promise<void> {
  if (modelOverride) {
    const { providerId, model } = parseModelOverride(modelOverride)
    await authFetch(`/api/agents/${agentId}/model`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, model }),
    })
  } else {
    await authFetch(`/api/agents/${agentId}/model`, { method: 'DELETE' })
  }
}

// Model-only modal for built-in agents — rendered outside the main component tree
function BuiltInModelModal({
  agentId,
  onClose,
  onSaved,
}: {
  agentId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [value, setValue] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const defaults = useAgentsStore((s) => s.defaults)
  const userItems = useAgentsStore((s) => s.userItems)
  const projectItems = useAgentsStore((s) => s.projectItems)
  const agents = [...defaults, ...userItems, ...projectItems]
  const agent = agentId ? agents.find((a) => a.id === agentId) : undefined
  const providers = useConfigStore((s) => s.providers)

  useEffect(() => {
    if (!agentId) return
    setLoading(true)
    authFetch(`/api/agents/${agentId}/model`)
      .then((r) => r.json())
      .then((data) => {
        setValue(data.providerId && data.model ? `${data.providerId}/${data.model}` : undefined)
      })
      .catch(() => setValue(undefined))
      .finally(() => setLoading(false))
  }, [agentId])

  const handleSave = async () => {
    if (!agentId) return
    setSaving(true)
    setError(null)
    try {
      await saveAgentModelOverride(agentId, value)
      onSaved()
      onClose()
    } catch {
      setError('Failed to save. Please try again.')
    }
    setSaving(false)
  }

  return (
    <Modal isOpen={!!agentId} onClose={onClose} title={`Model — ${agent?.name ?? agentId ?? ''}`} size="md">
      <div className="space-y-4 p-2">
        <p className="text-xs text-text-muted">
          Choose which model to use when this agent is active. This overrides the session/global model.
        </p>
        {loading ? (
          <div className="text-sm text-text-muted py-2">Loading...</div>
        ) : (
          <ModelPicker providers={providers} value={value} onChange={setValue} defaultLabel="Default (global model)" />
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded bg-accent-primary/20 text-sm text-accent-primary font-medium hover:bg-accent-primary/30 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
