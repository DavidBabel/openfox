import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useSessionStore } from '../../stores/session'
import { SessionPane } from './SessionPane'
import { SplitControlPanel } from './SplitControlPanel'
import { readSplitLayoutMode, writeSplitLayoutMode } from '../../lib/splitPersistence'

interface SplitViewProps {
  /** When false the left control column collapses (toggled from the header). */
  controlOpen?: boolean
}

export function SplitView({ controlOpen = true }: SplitViewProps) {
  const [, navigate] = useLocation()
  const openSessionIds = useSessionStore((state) => state.openSessionIds)
  const focusedSessionId = useSessionStore((state) => state.focusedSessionId ?? state.currentSession?.id)
  const focusPane = useSessionStore((state) => state.focusPane)
  const closePane = useSessionStore((state) => state.closePane)
  const [layout, setLayout] = useState(readSplitLayoutMode)

  useEffect(() => {
    writeSplitLayoutMode(layout)
  }, [layout])

  // Navigate home only when the user closes the last pane. A fresh visit with
  // no panes stays put and shows an empty state so the control panel can open
  // sessions (restoration in App happens before this component mounts).
  const prevCountRef = useRef(openSessionIds.length)
  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = openSessionIds.length
    if (prev > 0 && openSessionIds.length === 0) {
      navigate('/')
    }
  }, [openSessionIds.length, navigate])

  const panesArea =
    openSessionIds.length === 0 ? (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-text-muted px-4 text-center">
          No panes open — pick a session on the left to open it in split view.
        </p>
      </div>
    ) : layout === 'columns' ? (
      <div className="flex gap-px bg-border flex-1 min-w-0 min-h-0">
        {openSessionIds.map((sessionId) => {
          const focused = sessionId === focusedSessionId
          return (
            <SessionPane
              key={sessionId}
              className="flex-1"
              sessionId={sessionId}
              focused={focused}
              onFocus={() => focusPane(sessionId)}
              onClose={() => closePane(sessionId)}
            />
          )
        })}
      </div>
    ) : (
      <div
        className={`grid gap-px bg-border flex-1 min-w-0 min-h-0 ${
          openSessionIds.length <= 1 ? 'grid-cols-1' : 'grid-cols-2'
        }`}
      >
        {openSessionIds.map((sessionId) => {
          const focused = sessionId === focusedSessionId
          return (
            <SessionPane
              key={sessionId}
              sessionId={sessionId}
              focused={focused}
              onFocus={() => focusPane(sessionId)}
              onClose={() => closePane(sessionId)}
            />
          )
        })}
      </div>
    )

  return (
    <div className="flex-1 min-w-0 flex h-full min-h-0 bg-primary">
      <SplitControlPanel collapsed={!controlOpen} layout={layout} onLayoutChange={setLayout} />
      {panesArea}
    </div>
  )
}
