/**
 * Responsive sidebar visibility.
 *
 * Both the left (session list) and right (criteria) sidebars used to collapse
 * at the same fixed viewport breakpoint, which let the chat feed shrink to
 * unusable widths. Instead, the feed width is derived from the available
 * width and the current sidebar widths, and must always stay at least
 * `feedMinWidth` wide. When space runs out the left sidebar collapses first,
 * then the right one.
 */

export type SidebarMode = 'closed' | 'inline' | 'overlay'

export interface SidebarPreferences {
  left: boolean
  right: boolean
}

export interface SidebarVisibilityParams {
  /** Width available to the layout (viewport on desktop, pane in split view). */
  availableWidth: number
  /** Current width of the left sidebar when open. */
  leftWidth: number
  /** Current width of the right sidebar when open. */
  rightWidth: number
  /** Minimum width the chat feed must keep. */
  feedMinWidth: number
  /** User preference, persisted — drives inline state when it fits. */
  preferred: SidebarPreferences
  /** User explicitly opened a sidebar that cannot fit inline — transient. */
  overlayOpen: SidebarPreferences
}

export interface SidebarVisibilityResult {
  left: SidebarMode
  right: SidebarMode
  /** Whether the left sidebar can be inline given the right sidebar's claim. */
  leftFits: boolean
  /** Whether the right sidebar can be inline (the left yields first). */
  rightFits: boolean
}

export const FEED_MIN_WIDTH = 360

/**
 * Compute how the left and right sidebars should render so the chat feed
 * always keeps `feedMinWidth` pixels. The right sidebar has priority: when
 * space is short the left sidebar (session list) collapses first, then the
 * right one. A sidebar is `inline` only when it fits next to the feed; if the
 * user wants it open but it cannot fit, it renders as an `overlay` (floating,
 * so the feed keeps its full width) — but only when explicitly opened there,
 * never automatically.
 */
export function computeSidebarVisibility({
  availableWidth,
  leftWidth,
  rightWidth,
  feedMinWidth,
  preferred,
  overlayOpen,
}: SidebarVisibilityParams): SidebarVisibilityResult {
  // The right sidebar fits inline whenever it alone leaves room for the feed
  // floor (the left sidebar yields first).
  const rightFits = availableWidth - rightWidth >= feedMinWidth
  const right: SidebarMode = rightFits
    ? preferred.right
      ? 'inline'
      : 'closed'
    : overlayOpen.right
      ? 'overlay'
      : 'closed'

  // The left sidebar only gets inline space once the right sidebar's claim is
  // accounted for. When the user wants the right sidebar inline (even if it
  // currently cannot fit), it reserves its width so the left sidebar never
  // takes the slot that would otherwise go to it.
  const rightReserves = preferred.right
  const leftFits = availableWidth - leftWidth - (rightReserves ? rightWidth : 0) >= feedMinWidth
  const left: SidebarMode = leftFits ? (preferred.left ? 'inline' : 'closed') : overlayOpen.left ? 'overlay' : 'closed'

  return { left, right, leftFits, rightFits }
}
