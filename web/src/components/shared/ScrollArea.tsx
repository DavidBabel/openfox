import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import type { OverlayScrollbarsComponentRef, OverlayScrollbarsComponentProps } from 'overlayscrollbars-react'
import type { OverlayScrollbars } from 'overlayscrollbars'

export type ScrollAreaProps = OverlayScrollbarsComponentProps<'div'> & {
  horizontal?: boolean
  both?: boolean
  onScrollbarDrag?: () => void
}

export const ScrollArea = forwardRef<OverlayScrollbarsComponentRef<'div'>, ScrollAreaProps>(
  ({ options, horizontal, both, onScrollbarDrag, ...props }, ref) => {
    const isHorizontal = horizontal || both
    const osRef = useRef<OverlayScrollbars | null>(null)
    const onDragRef = useRef(onScrollbarDrag)
    onDragRef.current = onScrollbarDrag

    const events = useMemo(() => {
      if (!onScrollbarDrag) return undefined
      return {
        initialized: (instance: OverlayScrollbars) => {
          osRef.current = instance
        },
      }
    }, [onScrollbarDrag])

    useEffect(() => {
      const os = osRef.current
      if (!os || !onScrollbarDrag) return

      const handle = os.elements().scrollbarVertical.handle
      const track = os.elements().scrollbarVertical.track
      const onInteraction = () => onDragRef.current?.()

      handle.addEventListener('pointerdown', onInteraction)
      track.addEventListener('pointerdown', onInteraction)

      return () => {
        handle.removeEventListener('pointerdown', onInteraction)
        track.removeEventListener('pointerdown', onInteraction)
      }
    }, [onScrollbarDrag])

    return (
      <OverlayScrollbarsComponent
        ref={ref}
        events={events}
        options={{
          overflow: {
            x: isHorizontal ? 'scroll' : 'hidden',
            y: both ? 'scroll' : horizontal ? 'hidden' : 'scroll',
          },
          scrollbars: {
            autoHide: isHorizontal ? 'leave' : 'move',
            autoHideDelay: isHorizontal ? 1500 : 600,
            clickScroll: 'instant',
          },
          update: {
            elementEvents: [[':scope', 'mouseenter']],
          },
          ...options,
        }}
        {...props}
      />
    )
  },
)
ScrollArea.displayName = 'ScrollArea'
