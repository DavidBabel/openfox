import type { ReactNode } from 'react'
import { ScrollArea } from './ScrollArea'

type ParseSuccess = { success: true; parsed: Record<string, unknown> }
type ParseError = { success: false; error: ReactNode }
type ParseResult = ParseSuccess | ParseError

export function tryParseResult(result: string, label: string): ParseResult {
  try {
    return { success: true, parsed: JSON.parse(result) as Record<string, unknown> }
  } catch {
    console.warn(`${label}: failed to parse result JSON`, result.slice(0, 200))
    return {
      success: false,
      error: (
        <ScrollArea horizontal className="max-h-[60vh]">
          <pre className="text-xs bg-bg-primary p-1.5 rounded break-words">{result}</pre>
        </ScrollArea>
      ),
    }
  }
}
