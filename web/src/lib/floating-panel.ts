export interface AnchorRect {
  top: number
  bottom: number
  left: number
  width: number
}

export interface PanelSize {
  width: number
  height: number
}

export interface ViewportSize {
  width: number
  height: number
}

export interface PopoverPosition {
  top: number
  left: number
}

const DEFAULT_MARGIN = 4

/**
 * Pure placement logic for a floating panel anchored to a rectangle
 * (typically the bounding rect of a composer wrapper). Places the panel below
 * the anchor when it fits in the viewport, otherwise flips it above. Horizontal
 * placement clamps the panel inside the viewport so it never overflows.
 */
export function computePopoverPosition(
  anchor: AnchorRect,
  panel: PanelSize,
  viewport: ViewportSize,
  margin = DEFAULT_MARGIN,
): PopoverPosition {
  const maxLeft = Math.max(0, viewport.width - panel.width)
  const left = Math.min(Math.max(0, anchor.left), maxLeft)
  const spaceBelow = viewport.height - anchor.bottom
  if (spaceBelow >= panel.height + margin) {
    return { top: anchor.bottom + margin, left }
  }
  return { top: Math.max(margin, anchor.top - panel.height - margin), left }
}
