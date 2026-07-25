export interface WorkflowParam {
  id: string
  label: string
  description?: string
  position?: number
  required?: boolean
}

export interface WorkflowInfo {
  id: string
  name: string
  parameters?: WorkflowParam[]
}

export interface SlashCommandResult {
  workflowId: string
  params: Record<string, string>
}

/**
 * Parse a slash command from chat input.
 * Returns null if the input is not a recognized slash command.
 */
export function parseSlashCommand(input: string, workflows: WorkflowInfo[]): SlashCommandResult | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const parts = trimmed.slice(1).split(/\s+/)
  const workflowId = parts[0]
  if (!workflowId) return null

  const wf = workflows.find((w) => w.id === workflowId)
  if (!wf) return null

  const args = parts.slice(1)
  const params: Record<string, string> = {}

  if (wf.parameters && wf.parameters.length > 0) {
    const sorted = [...wf.parameters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    sorted.forEach((p, i) => {
      if (args[i] !== undefined) {
        params[p.id] = args[i]!
      }
    })
  } else {
    args.forEach((arg, i) => {
      params[String(i)] = arg
    })
  }

  return { workflowId, params }
}
