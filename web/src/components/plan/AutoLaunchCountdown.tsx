import { useEffect, useState } from 'react'
import { useT } from '../../hooks/useT'
import { CloseButton } from '../shared/CloseButton'

/** Countdown pill shown under the favorite workflow button before auto-launch. */
export function AutoLaunchCountdown({ deadline, onCancel }: { deadline: number; onCancel: () => void }) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000))

  return (
    <div
      data-testid="autolaunch-countdown"
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-bg-tertiary/70 border border-border text-xs text-text-secondary animate-pulse"
    >
      <span>
        ⏳ {t({ en: 'Auto-launch in {{seconds}}s', fr: 'Lancement automatique dans {{seconds}} s' }, { seconds })}
      </span>
      <CloseButton
        onClick={onCancel}
        size="sm"
        className="text-text-muted hover:text-text-primary p-0.5"
        aria-label={t({ en: 'Cancel auto-launch', fr: 'Annuler le lancement automatique' })}
      />
    </div>
  )
}
