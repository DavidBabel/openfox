/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest'
import http from 'node:http'
import { PassThrough } from 'node:stream'
import { Socket } from 'node:net'

const origRequest = http.request.bind(http)
http.request = function (this: any, ...args: any[]) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.href || ''
  if (typeof url === 'string' && (url.includes('localhost:3000') || url.includes('127.0.0.1:3000'))) {
    const body = JSON.stringify({ value: '' })
    const mockRes = new PassThrough() as any
    mockRes.statusCode = 200
    mockRes.statusMessage = 'OK'
    mockRes.headers = { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)) }
    mockRes.rawHeaders = ['Content-Type', 'application/json', 'Content-Length', String(Buffer.byteLength(body))]
    mockRes.write(Buffer.from(body))
    mockRes.end()

    const mockReq = new PassThrough() as any
    mockReq.setTimeout = () => mockReq
    mockReq.setSocketKeepAlive = () => {}
    mockReq.socket = new Socket()
    mockReq.destroyed = false
    mockReq.destroy = () => {}
    mockReq.headers = {}
    process.nextTick(() => mockReq.emit('response', mockRes))
    return mockReq
  }
  return (origRequest as any)(...args)
} as any

// Mock overlayscrollbars-react for jsdom (hooks crash without browser APIs)
vi.mock('overlayscrollbars-react', () => {
  const React = require('react')
  const MockOverlayScrollbarsComponent = React.forwardRef(
    ({ children, options, events, defer, ...divProps }: any, ref: any) => {
      return React.createElement('div', { ...divProps, ref }, children)
    },
  )
  MockOverlayScrollbarsComponent.displayName = 'OverlayScrollbarsComponent'

  return {
    OverlayScrollbarsComponent: MockOverlayScrollbarsComponent,
    useOverlayScrollbars: () => [() => {}, () => null],
  }
})
