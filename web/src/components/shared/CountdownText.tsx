import { useEffect, useState } from 'react'
import { useT } from '../../hooks/useT'
import { CloseButton } from './CloseButton'

export interface CountdownTextProps {
  deadline: number
  onCancel: () => void
  /** Render the countdown label; receives the remaining whole seconds. */
  format: (seconds: number) => string
  /** Text color (the themed workflow/button accent). */
  color?: string
  testId?: string
}

/** Plain-text countdown (no background/border), tiny font, themed color. */
export function CountdownText({ deadline, onCancel, format, color, testId }: CountdownTextProps) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-1 text-[10px] leading-none opacity-80"
      style={{ color: color ?? 'rgb(var(--color-accent-primary))' }}
    >
      <span>{format(seconds)}</span>
      <CloseButton
        onClick={onCancel}
        size="sm"
        className="p-0.5 opacity-70 hover:opacity-100"
        aria-label={t({ en: 'Cancel', fr: 'Annuler' })}
      />
    </div>
  )
}
