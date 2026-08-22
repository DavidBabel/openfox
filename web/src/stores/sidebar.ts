import { create } from 'zustand'

interface SidebarState {
  /** Current resizable width of the left sidebar (session list). */
  leftWidth: number
  /** Current resizable width of the right sidebar (criteria). */
  rightWidth: number
  setLeftWidth: (width: number) => void
  setRightWidth: (width: number) => void
}

/**
 * Tracks the current resizable sidebar widths so the layout can derive the
 * chat feed width (available width minus inline sidebars) and auto-collapse
 * the sidebars before the feed becomes unusable.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  leftWidth: 300,
  rightWidth: 320,
  setLeftWidth: (width) => set({ leftWidth: width }),
  setRightWidth: (width) => set({ rightWidth: width }),
}))
