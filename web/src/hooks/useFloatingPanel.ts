import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { computePopoverPosition } from '../lib/floating-panel'

export interface FloatingLayout {
  top: number
  left: number
  width: number
}

/**
 * Positions a panel in a portal relative to an anchor element, so dropdowns
 * escape overflow-hidden ancestors (modals, scroll areas). While open, the
 * panel is repositioned on window scroll/resize (coalesced to one update per
 * frame) and whenever the panel or anchor resizes (content swaps such as a
 * loading spinner growing into a list, or a resize-y textarea being dragged).
 *
 * Returns a ref to attach to the portaled panel and the current layout. The
 * panel must be rendered whenever `open` is true so it can be measured — the
 * caller renders it into a portal (e.g. via `createPortal(panel, document.body)`).
 */
export function useFloatingPanel(
  anchorRef: RefObject<HTMLElement | null> | undefined,
  open: boolean,
): { panelRef: RefObject<HTMLDivElement | null>; layout: FloatingLayout | null } {
  const panelRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<FloatingLayout | null>(null)

  const updatePosition = useCallback(() => {
    const anchor = anchorRef?.current
    const panel = panelRef.current
    if (!anchor || !panel) return
    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const { top, left } = computePopoverPosition(
      { top: anchorRect.top, bottom: anchorRect.bottom, left: anchorRect.left, width: anchorRect.width },
      { width: panelRect.width || anchorRect.width, height: panelRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    )
    setLayout({ top, left, width: anchorRect.width })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!open) {
      setLayout(null)
      return
    }
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(updatePosition)
    }
    // Capture-phase scroll catches ancestor scrollers (e.g. the modal body),
    // which move the anchor in the viewport even though the window itself
    // does not scroll.
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    // Reposition when the panel or anchor resizes while open: a loading
    // spinner grows into a tall list, suggestion counts change as the user
    // types, and a resize-y textarea changes the anchor's height.
    let observer: ResizeObserver | null = null
    const anchor = anchorRef?.current
    const panel = panelRef.current
    if (typeof ResizeObserver !== 'undefined' && anchor && panel) {
      observer = new ResizeObserver(schedule)
      observer.observe(panel)
      observer.observe(anchor)
    }
    return () => {
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [open, anchorRef, updatePosition])

  return { panelRef, layout }
}
