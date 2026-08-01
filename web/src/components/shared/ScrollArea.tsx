import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import type { OverlayScrollbarsComponentRef, OverlayScrollbarsComponentProps } from 'overlayscrollbars-react'
import type { OverlayScrollbars } from 'overlayscrollbars'
import type { ScrollbarGestureKind } from '@/hooks/useAutoScroll.ts'

export type { ScrollbarGestureKind }

export type ScrollAreaProps = OverlayScrollbarsComponentProps<'div'> & {
  horizontal?: boolean
  both?: boolean
  onScrollbarGesture?: (kind: ScrollbarGestureKind, gapToEndPx: number | null) => void
}

export const ScrollArea = forwardRef<OverlayScrollbarsComponentRef<'div'>, ScrollAreaProps>(
  ({ options, horizontal, both, onScrollbarGesture, ...props }, ref) => {
    const isHorizontal = horizontal || both
    const onGestureRef = useRef(onScrollbarGesture)
    onGestureRef.current = onScrollbarGesture
    const cleanupRef = useRef<(() => void) | null>(null)

    const events = useMemo(() => {
      const attach = (instance: OverlayScrollbars) => {
        cleanupRef.current?.()
        const scrollbar = instance.elements().scrollbarVertical
        const getGap = (): number | null => {
          const handleRect = scrollbar.handle.getBoundingClientRect()
          const trackRect = scrollbar.track.getBoundingClientRect()
          if (handleRect.height === 0 || trackRect.height === 0) return null
          return Math.max(0, trackRect.bottom - handleRect.bottom)
        }
        let dragCleanup: (() => void) | null = null
        const endDrag = () => {
          onGestureRef.current?.('up', getGap())
          dragCleanup?.()
        }
        const onMove = (e: PointerEvent) => {
          if (e.buttons === 0) {
            endDrag()
            return
          }
          onGestureRef.current?.('move', getGap())
        }
        const beginDrag = () => {
          onGestureRef.current?.('down', getGap())
          dragCleanup?.()
          window.addEventListener('pointermove', onMove)
          window.addEventListener('pointerup', endDrag)
          window.addEventListener('pointercancel', endDrag)
          dragCleanup = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', endDrag)
            window.removeEventListener('pointercancel', endDrag)
            dragCleanup = null
          }
        }
        scrollbar.track.addEventListener('pointerdown', beginDrag)
        cleanupRef.current = () => {
          scrollbar.track.removeEventListener('pointerdown', beginDrag)
          dragCleanup?.()
        }
      }
      return { initialized: attach }
    }, [])

    useEffect(() => () => cleanupRef.current?.(), [])

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
