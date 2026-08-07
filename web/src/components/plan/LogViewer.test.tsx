// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act, type ReactElement } from 'react'

// React 19 requires this flag before act() can be used (repo convention).
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

import { LogViewer } from './LogViewer'

function render(element: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => root.render(element))
  return { root, container }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('LogViewer', () => {
  it('renders the subtitle at the top when provided', () => {
    render(
      <LogViewer
        title="dev-server"
        subtitle="npm run dev"
        logs={[{ stream: 'stdout', content: 'hello' }]}
        onClose={() => {}}
      />,
    )

    const strip = document.body.querySelector('.subtitle-strip')
    expect(strip).not.toBeNull()
    expect(strip?.textContent).toContain('npm run dev')
  })

  it('omits the subtitle strip when absent', () => {
    render(<LogViewer title="dev-server" logs={[{ stream: 'stdout', content: 'hello' }]} onClose={() => {}} />)

    expect(document.body.querySelector('.subtitle-strip')).toBeNull()
  })
})
