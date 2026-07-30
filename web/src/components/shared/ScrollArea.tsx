import { forwardRef } from 'react'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import type { OverlayScrollbarsComponentRef, OverlayScrollbarsComponentProps } from 'overlayscrollbars-react'

export type ScrollAreaProps = OverlayScrollbarsComponentProps<'div'> & {
  horizontal?: boolean
  both?: boolean
}

export const ScrollArea = forwardRef<OverlayScrollbarsComponentRef<'div'>, ScrollAreaProps>(
  ({ options, horizontal, both, ...props }, ref) => {
    const isHorizontal = horizontal || both
    return (
      <OverlayScrollbarsComponent
        ref={ref}
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
          ...options,
        }}
        {...props}
      />
    )
  },
)
ScrollArea.displayName = 'ScrollArea'
