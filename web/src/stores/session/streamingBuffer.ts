import type { StreamingBuffer } from './types'

const buffer: StreamingBuffer = {
  messageId: null,
  deltaContent: '',
  thinkingContent: '',
  toolOutput: [],
}

let flushFn: (() => void) | null = null
let pendingTimer: ReturnType<typeof setTimeout> | number | null = null
let pendingTimerKind: 'raf' | 'timeout' | null = null
let lastFlushTime = 0
// One render per frame at most (~60fps). Deltas arriving within the same
// frame are coalesced into a single render via the rAF fast path below.
const MIN_STREAM_FLUSH_INTERVAL_MS = 16

export function setFlushFn(fn: () => void) {
  flushFn = fn
}

export function getBuffer(): StreamingBuffer {
  return buffer
}

function clearPendingTimer() {
  if (pendingTimer === null) return
  if (pendingTimerKind === 'raf') {
    cancelAnimationFrame(pendingTimer as number)
  } else {
    clearTimeout(pendingTimer)
  }
  pendingTimer = null
  pendingTimerKind = null
}

function doFlush() {
  pendingTimer = null
  pendingTimerKind = null
  lastFlushTime = Date.now()
  flushFn?.()
}

export function scheduleStreamingFlush() {
  if (pendingTimer !== null) return
  const elapsed = Date.now() - lastFlushTime
  if (elapsed >= MIN_STREAM_FLUSH_INTERVAL_MS) {
    // Fast path: enough time passed since the last flush — defer to the next
    // animation frame so deltas arriving in the same frame coalesce into one render.
    // rAF is paused in hidden tabs, so fall back to a timeout there.
    if (typeof document !== 'undefined' && document.hidden) {
      pendingTimer = setTimeout(doFlush, 0)
      pendingTimerKind = 'timeout'
    } else {
      pendingTimer = requestAnimationFrame(doFlush)
      pendingTimerKind = 'raf'
    }
  } else {
    // Throttle: wait until the minimum interval has elapsed since the last flush.
    pendingTimer = setTimeout(doFlush, MIN_STREAM_FLUSH_INTERVAL_MS - elapsed)
    pendingTimerKind = 'timeout'
  }
}

export function cancelStreamingFlush() {
  clearPendingTimer()
  flushFn?.()
  buffer.messageId = null
  buffer.deltaContent = ''
  buffer.thinkingContent = ''
  buffer.toolOutput = []
  // The flush above is a terminal commit (end of message, error, session switch).
  // Reset the throttle window so the first delta of the next message renders
  // immediately instead of waiting out the remaining interval.
  lastFlushTime = 0
}
