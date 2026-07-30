import { ScrollArea } from './ScrollArea'
import { memo } from 'react'
import { Markdown } from './Markdown'

interface ThinkingBlockProps {
  content: string
  variant?: 'default' | 'labeled'
}

export const ThinkingBlock = memo(function ThinkingBlock({ content, variant = 'default' }: ThinkingBlockProps) {
  if (variant === 'labeled') {
    return (
      <div className="text-text-muted text-sm italic feed-item">
        <span className="text-text-thinking">thinking:</span>
        <ScrollArea horizontal className="ml-1.5 mt-0.5">
          <Markdown content={content} />
        </ScrollArea>
      </div>
    )
  }

  return (
    <ScrollArea horizontal className="text-text-muted text-sm italic bg-secondary rounded p-1.5 feed-item">
      <Markdown content={content} muted />
    </ScrollArea>
  )
})
