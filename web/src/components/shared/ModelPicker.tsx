import { ScrollArea } from './ScrollArea'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDownIcon, SearchIcon } from './icons'
import { useModelSearch, ModelEntryRow } from '../settings/model-list'
import type { Provider } from '../../stores/config'
import { shouldAutofocus } from '../../lib/device'
import { formatModelValue, parseModelValue } from '../../lib/model-value'

export interface ModelPickerProps {
  providers: Provider[]
  value: string | undefined
  onChange: (value: string | undefined) => void
  defaultLabel?: string
}

export function ModelPicker({ providers, value, onChange, defaultLabel = 'Default (global model)' }: ModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  const parsedValue = parseModelValue(value)
  const selectedModelId = parsedValue?.model
  const selectedEffort = parsedValue?.reasoningEffort
  const shortModelName = selectedModelId
    ? (selectedModelId.split('/').pop()?.replace(/-/g, ' ') ?? selectedModelId)
    : undefined

  const {
    searchQuery,
    setSearchQuery,
    highlightedIndex,
    setHighlightedIndex,
    visibleGroups,
    flatItems,
    handleSearchKeyDown,
    highlightedRef,
    inputRef,
  } = useModelSearch({
    providers,
    onSelect: (providerId, modelId) => {
      onChange(formatModelValue(providerId, modelId))
      setIsOpen(false)
    },
    onEscape: () => setIsOpen(false),
  })

  // Position the dropdown relative to the button
  const updateDropdownPosition = useCallback(() => {
    if (!isOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${Math.max(rect.width, 288)}px`,
    })
  }, [isOpen])

  useEffect(() => {
    updateDropdownPosition()
    window.addEventListener('scroll', updateDropdownPosition, true)
    window.addEventListener('resize', updateDropdownPosition)
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true)
      window.removeEventListener('resize', updateDropdownPosition)
    }
  }, [updateDropdownPosition])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !(event.target as Element)?.closest('[data-model-picker-dropdown]')
      ) {
        setIsOpen(false)
        setSearchQuery('')
        setHighlightedIndex(-1)
      }
    }
    // Delay to prevent the same click that opened it from closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, setSearchQuery, setHighlightedIndex])

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      updateDropdownPosition()
      if (shouldAutofocus()) inputRef.current?.focus()
    } else {
      setSearchQuery('')
      setHighlightedIndex(-1)
    }
  }, [isOpen, setSearchQuery, setHighlightedIndex, inputRef, updateDropdownPosition])

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-bg-tertiary border border-border rounded text-sm text-text-primary hover:bg-bg-secondary transition-colors"
      >
        <span className={shortModelName ? 'text-text-primary' : 'text-text-muted'}>
          {shortModelName ?? defaultLabel}
          {shortModelName && selectedEffort && <span className="text-text-muted">:{selectedEffort}</span>}
        </span>
        <ChevronDownIcon className={`w-3 h-3 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div data-model-picker-dropdown className="z-50" style={dropdownStyle}>
            <div className="bg-bg-secondary border border-border rounded-lg shadow-lg flex flex-col max-h-80">
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border flex-shrink-0">
                <SearchIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onInput={(e) => {
                    setSearchQuery(e.currentTarget.value)
                    setHighlightedIndex(-1)
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search models..."
                  className="bg-transparent border-none outline-none text-sm text-text-primary w-full placeholder:text-text-muted"
                />
              </div>

              <ScrollArea className="flex-1">
                {/* Default option */}
                <button
                  type="button"
                  onClick={() => {
                    onChange(undefined)
                    setIsOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-bg-tertiary ${
                    !value ? 'text-accent-primary bg-accent-primary/5' : 'text-text-muted'
                  }`}
                >
                  {defaultLabel}
                </button>

                {visibleGroups.map((group) => (
                  <div key={group.provider.id}>
                    <div className="px-4 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider bg-bg-tertiary/50">
                      {group.provider.name}
                    </div>
                    {group.models.map((modelConfig) => {
                      const modelFlatIndex = flatItems.findIndex(
                        (fi) => fi.providerId === group.provider.id && fi.modelConfig.id === modelConfig.id,
                      )
                      const isHighlighted = modelFlatIndex === highlightedIndex
                      const isActive =
                        !!parsedValue &&
                        parsedValue.providerId === group.provider.id &&
                        parsedValue.model === modelConfig.id
                      return (
                        <div
                          key={`${group.provider.id}/${modelConfig.id}`}
                          ref={isHighlighted ? highlightedRef : undefined}
                        >
                          <ModelEntryRow
                            providerId={group.provider.id}
                            modelConfig={modelConfig}
                            isActive={isActive}
                            highlighted={isHighlighted}
                            onModelClick={(providerId, modelId) => {
                              onChange(formatModelValue(providerId, modelId))
                              setIsOpen(false)
                            }}
                            reasoningEfforts={modelConfig.reasoningEfforts}
                            selectedEffort={isActive ? selectedEffort : undefined}
                            onSelectEffort={(providerId, modelId, effort) => {
                              onChange(formatModelValue(providerId, modelId, effort))
                              setIsOpen(false)
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}

                {visibleGroups.length === 0 && searchQuery.trim() && (
                  <div className="px-4 py-3 text-sm text-text-muted text-center">No models match your search</div>
                )}
              </ScrollArea>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
