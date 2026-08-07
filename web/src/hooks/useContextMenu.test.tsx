// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { renderHook } from '@testing-library/react'
import { useContextMenu } from './useContextMenu'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function setup() {
  return renderHook(() => useContextMenu())
}

function makeEvent(target: Element | null) {
  return {
    clientX: 42,
    clientY: 84,
    target,
    preventDefault: vi.fn(),
  } as unknown as React.MouseEvent
}

describe('useContextMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.spyOn(window, 'getSelection').mockReturnValue(null as unknown as Selection)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('opens the menu on right-click when enabled and nothing is selected', () => {
    const { result } = setup()
    const div = document.createElement('div')
    document.body.appendChild(div)
    const event = makeEvent(div)
    act(() => {
      result.current.onContextMenu(event, true)
    })
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it('does nothing when disabled', () => {
    const { result } = setup()
    const div = document.createElement('div')
    document.body.appendChild(div)
    const event = makeEvent(div)
    act(() => {
      result.current.onContextMenu(event, false)
    })
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('does not open the menu when text is selected', () => {
    const { result } = setup()
    vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'selected text' } as unknown as Selection)
    const div = document.createElement('div')
    document.body.appendChild(div)
    const event = makeEvent(div)
    act(() => {
      result.current.onContextMenu(event, true)
    })
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('lets the browser handle right-clicks directly on a link', () => {
    const { result } = setup()
    const link = document.createElement('a')
    document.body.appendChild(link)
    const event = makeEvent(link)
    act(() => {
      result.current.onContextMenu(event, true)
    })
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('lets the browser handle right-clicks on elements nested inside a link', () => {
    const { result } = setup()
    const span = document.createElement('span')
    const link = document.createElement('a')
    link.appendChild(span)
    document.body.appendChild(link)
    const event = makeEvent(span)
    act(() => {
      result.current.onContextMenu(event, true)
    })
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
