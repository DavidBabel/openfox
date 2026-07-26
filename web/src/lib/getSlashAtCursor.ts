/**
 * Detect a slash command (/query) at the cursor position in text.
 * Returns null if no active slash command is being typed.
 */
export function getSlashAtCursor(text: string, cursorPos: number): { query: string; startIndex: number } | null {
  const beforeCursor = text.slice(0, cursorPos)

  // Only trigger when / is at the very start of input
  if (beforeCursor.length === 0 || beforeCursor[0] !== '/') {
    return null
  }

  const query = beforeCursor.slice(1)

  // If there's whitespace after the slash, the command is already submitted
  if (query.includes(' ') || query.includes('\n') || query.includes('\t')) {
    return null
  }

  return { query, startIndex: 0 }
}
