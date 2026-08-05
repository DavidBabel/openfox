export function shouldAutofocus(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return !window.matchMedia('(hover: none) and (pointer: coarse)').matches
}
