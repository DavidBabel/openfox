import { useCallback } from 'react'
import type { RefObject } from 'react'
import type { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'

export const useViewport = (ref: RefObject<OverlayScrollbarsComponentRef<'div'> | null>) =>
  useCallback(() => ref.current?.osInstance()?.elements().viewport ?? null, [ref])
