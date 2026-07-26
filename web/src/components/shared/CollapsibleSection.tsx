import type { ReactNode } from 'react'
import { ChevronDownIcon } from './icons/ChevronDownIcon'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

export function CollapsibleSection({ title, defaultOpen = false, children, className = '' }: CollapsibleSectionProps) {
  return (
    <details className={`group ${className}`} open={defaultOpen}>
      <summary className="text-[11px] text-text-secondary uppercase tracking-wider font-medium cursor-pointer select-none hover:text-text-primary transition-colors list-none flex items-center gap-1">
        <ChevronDownIcon className="w-3 h-3 transition-transform group-open:rotate-180" />
        {title}
      </summary>
      <div className="mt-2 space-y-2">{children}</div>
    </details>
  )
}
