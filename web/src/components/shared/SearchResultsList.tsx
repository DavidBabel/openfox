import { forwardRef, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react'
import { ScrollArea } from './ScrollArea'
import type { OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'

interface SearchResultsListProps {
  searchValue: string
  onSearchChange: (value: string) => void
  onSearchKeyDown: (e: React.KeyboardEvent) => void
  placeholder: string
  searchRef?: Ref<HTMLInputElement>
  icon?: ReactNode
  children?: ReactNode
  rows: ReactNode[]
  emptyText: ReactNode
  listRef?: Ref<OverlayScrollbarsComponentRef<'div'>>
}

export function SearchResultsList({
  searchValue,
  onSearchChange,
  onSearchKeyDown,
  placeholder,
  searchRef,
  icon,
  children,
  rows,
  emptyText,
  listRef,
}: SearchResultsListProps) {
  return (
    <>
      <div className="flex items-center gap-2 pb-2 shrink-0">
        {icon}
        <input
          ref={searchRef}
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-text-muted"
        />
      </div>
      {children}
      <ScrollArea ref={listRef} className="flex-1 min-h-0 -mx-4 -mb-4 px-4 pb-4">
        {rows.length === 0 ? <div className="px-3 py-4 text-center text-text-muted text-sm">{emptyText}</div> : rows}
      </ScrollArea>
    </>
  )
}

interface SelectableListButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean
  unselectedClassName?: string
}

export const SelectableListButton = forwardRef<HTMLButtonElement, SelectableListButtonProps>(
  (
    {
      selected,
      unselectedClassName = 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
      className = '',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type="button"
      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
        selected ? 'bg-accent-primary/20 text-text-primary' : unselectedClassName
      } ${className}`}
      {...props}
    />
  ),
)
SelectableListButton.displayName = 'SelectableListButton'
