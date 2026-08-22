import { describe, expect, it } from 'vitest'
import { computeSidebarVisibility, FEED_MIN_WIDTH } from './sidebar-visibility'
import type { SidebarVisibilityParams } from './sidebar-visibility'

const OPEN = { left: true, right: true }
const NO_OVERLAY = { left: false, right: false }

function compute(overrides: Partial<SidebarVisibilityParams> = {}) {
  return computeSidebarVisibility({
    availableWidth: 1400,
    leftWidth: 300,
    rightWidth: 320,
    feedMinWidth: FEED_MIN_WIDTH,
    preferred: OPEN,
    overlayOpen: NO_OVERLAY,
    ...overrides,
  })
}

describe('computeSidebarVisibility', () => {
  it('keeps both sidebars inline when both fit alongside the feed floor', () => {
    const vis = compute()
    expect(vis).toEqual({ left: 'inline', right: 'inline', leftFits: true, rightFits: true })
  })

  it('collapses the left sidebar first while the right sidebar stays inline', () => {
    const vis = compute({ availableWidth: 900 })
    expect(vis.right).toBe('inline')
    expect(vis.left).toBe('closed')
    expect(vis.rightFits).toBe(true)
    expect(vis.leftFits).toBe(false)
  })

  it('collapses the right sidebar too when closing the left alone is not enough', () => {
    const vis = compute({ availableWidth: 650 })
    expect(vis).toEqual({ left: 'closed', right: 'closed', leftFits: false, rightFits: false })
  })

  it('does not reopen the left sidebar while the right sidebar is blocked', () => {
    // 670 leaves room for the left alone (670-300=370 >= 360) but the right
    // sidebar cannot fit inline (670-320=350 < 360). Right has priority, so
    // the left sidebar must stay collapsed too — no flip-flopping while
    // shrinking.
    const vis = compute({ availableWidth: 670 })
    expect(vis).toEqual({ left: 'closed', right: 'closed', leftFits: false, rightFits: false })
  })

  it('auto-collapses a wanted sidebar instead of auto-opening it as an overlay', () => {
    const vis = compute({ availableWidth: 900 })
    expect(vis.left).toBe('closed')
  })

  it('opens a wanted sidebar as an overlay when explicitly requested and it cannot fit inline', () => {
    const vis = compute({ availableWidth: 900, overlayOpen: { left: true, right: false } })
    expect(vis.left).toBe('overlay')
    expect(vis.right).toBe('inline')
  })

  it('opens the right sidebar as an overlay when explicitly requested on tight space', () => {
    const vis = compute({ availableWidth: 650, overlayOpen: { left: false, right: true } })
    expect(vis.right).toBe('overlay')
    expect(vis.left).toBe('closed')
  })

  it('keeps overlays closed unless explicitly opened even on tight space', () => {
    const vis = compute({ availableWidth: 650, preferred: OPEN, overlayOpen: NO_OVERLAY })
    expect(vis.left).toBe('closed')
    expect(vis.right).toBe('closed')
  })

  it('restores the preferred inline state once the window widens again', () => {
    const narrow = compute({ availableWidth: 650 })
    expect(narrow.left).toBe('closed')
    expect(narrow.right).toBe('closed')

    const wide = compute({ availableWidth: 1400 })
    expect(wide).toEqual({ left: 'inline', right: 'inline', leftFits: true, rightFits: true })
  })

  it('lets the left sidebar be inline when the right sidebar is voluntarily closed', () => {
    const vis = compute({ availableWidth: 1000, preferred: { left: true, right: false } })
    expect(vis.left).toBe('inline')
    expect(vis.right).toBe('closed')
    expect(vis.leftFits).toBe(true)
  })

  it('closes both sidebars when neither sidebar can fit alongside the floor', () => {
    const vis = compute({ availableWidth: 500 })
    expect(vis).toEqual({ left: 'closed', right: 'closed', leftFits: false, rightFits: false })
  })

  it('closes a non-preferred sidebar even when it would fit inline', () => {
    const vis = compute({ preferred: { left: true, right: false } })
    expect(vis.right).toBe('closed')
    expect(vis.rightFits).toBe(true)
  })
})
