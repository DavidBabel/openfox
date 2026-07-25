// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { parseSlashCommand } from '../../lib/parse-slash-command'
import type { WorkflowInfo } from '../../lib/parse-slash-command'

describe('parseSlashCommand', () => {
  const workflows: WorkflowInfo[] = [
    {
      id: 'pr-review',
      name: 'PR Review',
      parameters: [
        { id: 'pr_number', label: 'PR Number', position: 0, required: true },
        { id: 'pr_title', label: 'PR Title', position: 1, required: false },
      ],
    },
    { id: 'simple', name: 'Simple' },
  ]

  it('parses /pr-review 157 into workflow and params', () => {
    const result = parseSlashCommand('/pr-review 157', workflows)
    expect(result).toEqual({ workflowId: 'pr-review', params: { pr_number: '157' } })
  })

  it('maps positional args by parameter position', () => {
    const result = parseSlashCommand('/pr-review 42 fix-bug', workflows)
    expect(result).toEqual({ workflowId: 'pr-review', params: { pr_number: '42', pr_title: 'fix-bug' } })
  })

  it('returns null for non-slash input', () => {
    expect(parseSlashCommand('hello world', workflows)).toBeNull()
  })

  it('returns null when workflow not found', () => {
    expect(parseSlashCommand('/nonexistent arg', workflows)).toBeNull()
  })

  it('returns null for just slash', () => {
    expect(parseSlashCommand('/', workflows)).toBeNull()
  })

  it('handles workflow without parameter definitions', () => {
    const result = parseSlashCommand('/simple foo bar', workflows)
    expect(result).toEqual({ workflowId: 'simple', params: { '0': 'foo', '1': 'bar' } })
  })

  it('handles extra args beyond defined parameters', () => {
    const result = parseSlashCommand('/pr-review 42', workflows)
    expect(result).toEqual({ workflowId: 'pr-review', params: { pr_number: '42' } })
  })
})
