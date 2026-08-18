interface PinIconProps {
  className?: string
}

export function PinIcon({ className = 'w-3.5 h-3.5 text-text-muted' }: PinIconProps) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v6l-2 2v2h10v-2l-2-2V3M12 21v-8" />
    </svg>
  )
}
