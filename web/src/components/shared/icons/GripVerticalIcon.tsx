interface GripVerticalIconProps {
  className?: string
}

export function GripVerticalIcon({ className = 'w-4 h-4' }: GripVerticalIconProps) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 5a2 2 0 100 4 2 2 0 000-4zM9 10a2 2 0 100 4 2 2 0 000-4zM9 15a2 2 0 100 4 2 2 0 000-4zM15 5a2 2 0 100 4 2 2 0 000-4zM15 10a2 2 0 100 4 2 2 0 000-4zM15 15a2 2 0 100 4 2 2 0 000-4z" />
    </svg>
  )
}
