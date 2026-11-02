import { useEffect, useRef } from 'react'

const dismissStack: symbol[] = []

export function useDismissOnEscape(open: boolean, onOpenChange: (open: boolean) => void) {
  const token = useRef(Symbol('dismiss-layer'))

  useEffect(() => {
    if (!open) return
    const currentToken = token.current
    dismissStack.push(currentToken)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || dismissStack.at(-1) !== currentToken) return
      if (document.querySelector('[data-state="open"][role="menu"], [data-state="open"][role="listbox"]')) return
      event.preventDefault()
      event.stopPropagation()
      onOpenChange(false)
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      document.removeEventListener('keydown', handleEscape, true)
      const index = dismissStack.lastIndexOf(currentToken)
      if (index >= 0) dismissStack.splice(index, 1)
    }
  }, [open, onOpenChange])
}
