import { Fragment } from 'react'
import { ansiToReact } from '../../lib/ansiParser'

interface LogEntry {
  stream: 'stdout' | 'stderr'
  content: string
  type?: 'marker'
}

interface LogRendererProps {
  logs: LogEntry[]
  preRef?: React.RefObject<HTMLPreElement | null>
  preClassName?: string
}

export function LogRenderer({ logs, preRef, preClassName = 'text-sm font-mono' }: LogRendererProps) {
  return (
    <pre ref={preRef} className={preClassName}>
      {logs.length === 0 ? (
        <span className="text-text-muted">No output yet</span>
      ) : (
        logs.map((chunk, i) =>
          chunk.type === 'marker' ? (
            <Fragment key={i}>
              <hr className="border-t border-border my-1" />
            </Fragment>
          ) : (
            <span key={i} className={chunk.stream === 'stderr' ? 'text-accent-warning' : ''}>
              {ansiToReact(chunk.content)}
            </span>
          ),
        )
      )}
    </pre>
  )
}
