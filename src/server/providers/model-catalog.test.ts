import { describe, expect, it } from 'vitest'
import { getCatalogEntry, getCatalogDefaultEffort, isReasoningEffortValue } from './model-catalog.js'

describe('model catalog', () => {
  it('maps deepseek-v4 flash/pro to none/low/high/max with a high default', () => {
    for (const id of ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-v4-flash-0731']) {
      expect(getCatalogEntry(id)).toEqual({
        reasoningEfforts: ['none', 'low', 'high', 'max'],
        defaultReasoningEffort: 'high',
      })
    }
  })

  it('maps qwen3.6/3.8 family members to low/medium/high', () => {
    for (const id of ['qwen3.6-35b-a3b', 'qwen3.6-max', 'qwen3.8-27b']) {
      expect(getCatalogEntry(id)?.reasoningEfforts).toEqual(['low', 'medium', 'high'])
    }
  })

  it('matches org-prefixed model ids via their basename', () => {
    expect(getCatalogEntry('Qwen/Qwen3.6-27B-FP8')?.reasoningEfforts).toEqual(['low', 'medium', 'high'])
    expect(getCatalogEntry('deepseek-ai/deepseek-v4-flash')?.reasoningEfforts).toEqual(['none', 'low', 'high', 'max'])
  })

  it('maps glm-5.2 to the full range and glm-5.3 to low/high/max', () => {
    expect(getCatalogEntry('glm-5.2')?.reasoningEfforts).toEqual([
      'none',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ])
    expect(getCatalogEntry('glm-5.2')?.defaultReasoningEffort).toBe('max')
    expect(getCatalogEntry('glm-5.3')?.reasoningEfforts).toEqual(['low', 'high', 'max'])
  })

  it('leaves non-configurable families without an entry', () => {
    // Gemma uses on/off thinking; GLM <= 5.1 and Kimi K2.x have no reasoning_effort.
    for (const id of ['gemma-4-31b-it', 'glm-5.1', 'glm-5', 'glm-4.7', 'kimi-k2.5', 'kimi-k2.6']) {
      expect(getCatalogEntry(id)).toBeUndefined()
    }
  })

  it('maps kimi-k3 and openai reasoning models', () => {
    expect(getCatalogEntry('kimi-k3')?.reasoningEfforts).toEqual(['low', 'high', 'max'])
    expect(getCatalogEntry('gpt-5.6')?.reasoningEfforts).toEqual(['minimal', 'low', 'medium', 'high'])
    expect(getCatalogEntry('o4-mini')?.reasoningEfforts).toEqual(['minimal', 'low', 'medium', 'high'])
  })

  it('returns undefined for unknown models', () => {
    expect(getCatalogEntry('unknown-model')).toBeUndefined()
    expect(getCatalogDefaultEffort('unknown-model')).toBeUndefined()
  })

  it('exposes the default effort helper', () => {
    expect(getCatalogDefaultEffort('deepseek-v4-flash')).toBe('high')
    expect(getCatalogDefaultEffort('qwen3.6-27b')).toBe('medium')
  })

  it('validates the canonical reasoning effort vocabulary', () => {
    for (const value of ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']) {
      expect(isReasoningEffortValue(value)).toBe(true)
    }
    expect(isReasoningEffortValue('ultra')).toBe(false)
    expect(isReasoningEffortValue('70b')).toBe(false)
    expect(isReasoningEffortValue('')).toBe(false)
  })
})
