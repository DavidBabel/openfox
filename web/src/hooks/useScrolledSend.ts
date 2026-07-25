import { useCallback } from 'react'
import { useSessionStore } from '../stores/session'
import type { Attachment } from '@shared/types.js'

export function useScrolledSend(setAutoScroll: (active: boolean) => void) {
  const storeSendMessage = useSessionStore((state) => state.sendMessage)
  const storeLaunchWorkflow = useSessionStore((state) => state.launchWorkflow)

  const sendMessage = useCallback(
    (content: string, attachments?: Attachment[], opts?: { messageKind?: 'command'; isSystemGenerated?: boolean }) => {
      setAutoScroll(true)
      storeSendMessage(content, attachments, opts)
    },
    [setAutoScroll, storeSendMessage],
  )

  const launchWorkflow = useCallback(
    (
      content?: string,
      attachments?: Attachment[],
      workflowId?: string,
      subGroup?: string,
      params?: Record<string, string>,
    ) => {
      setAutoScroll(true)
      storeLaunchWorkflow(content, attachments, workflowId, subGroup, params)
    },
    [setAutoScroll, storeLaunchWorkflow],
  )

  return { sendMessage, launchWorkflow }
}
