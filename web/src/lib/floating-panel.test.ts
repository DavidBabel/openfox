import { describe, expect, it } from 'vitest'
import { computePopoverPosition } from './floating-panel'

describe('computePopoverPosition', () => {
  it('places the panel below the anchor when there is room', () => {
    const anchor = { top: 334, bottom: 452, left: 60, width: 376 }
    const panel = { width: 276, height: 212 }
    const viewport = { width: 1000, height: 800 }
    expect(computePopoverPosition(anchor, panel, viewport)).toEqual({
      top: 456,
      left: 60,
    })
  })

  it('flips above when the panel does not fit below', () => {
    const anchor = { top: 660, bottom: 742, left: 396, width: 372 }
    const panel = { width: 228, height: 468 }
    const viewport = { width: 1000, height: 800 }
    expect(computePopoverPosition(anchor, panel, viewport)).toEqual({
      top: 188,
      left: 396,
    })
  })

  it('clamps horizontally so the panel stays inside the viewport', () => {
    const anchor = { top: 296, bottom: 434, left: 692, width: 220 }
    const panel = { width: 340, height: 260 }
    const viewport = { width: 1000, height: 800 }
    expect(computePopoverPosition(anchor, panel, viewport)).toEqual({
      top: 438,
      left: 660,
    })
  })

  it('flips above and clamps to the top margin when the panel would escape the top edge', () => {
    const anchor = { top: 144, bottom: 442, left: 624, width: 324 }
    const panel = { width: 116, height: 444 }
    const viewport = { width: 1000, height: 800 }
    expect(computePopoverPosition(anchor, panel, viewport)).toEqual({
      top: 4,
      left: 624,
    })
  })
})
