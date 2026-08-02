import type { Session } from '../../shared/types.js'

/**
 * Build the Session object sent to clients.
 * Full messages travel in the dedicated `messages` payload field (already
 * truncated server-side); embedding them again in `session.messages` would
 * double the payload for long sessions. `messageCount` is guaranteed so the
 * client can rely on it instead of `messages.length`.
 */
export function toClientSession(session: Session): Session {
  return {
    ...session,
    messageCount: session.messageCount ?? session.messages.length,
    messages: [],
  }
}
