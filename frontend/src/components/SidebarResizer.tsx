import { useEffect, useRef } from 'react'
import { useSettings } from '@/settings/SettingsProvider'

const MIN_WIDTH = 200
const MAX_WIDTH = 420
const DEFAULT_WIDTH = 260
const COLLAPSE_WIDTH = 74
const SNAP_THRESHOLD = 168

interface SidebarResizerProps {
  width: number
  collapsed: boolean
  onWidthChange: (width: number) => void
  onCollapsedChange: () => void
  onResizingChange: (resizing: boolean) => void
}

export function SidebarResizer({ width, collapsed, onWidthChange, onCollapsedChange, onResizingChange }: SidebarResizerProps) {
  const { t } = useSettings()
  const dragRef = useRef<{ startX: number; startWidth: number; collapsed: boolean } | null>(null)

  useEffect(() => () => {
    document.body.style.userSelect = ''
  }, [])

  const stopDragging = () => {
    if (!dragRef.current) return
    dragRef.current = null
    document.body.style.userSelect = ''
    onResizingChange(false)
  }

  const updateWidth = (nextWidth: number) => {
    const drag = dragRef.current
    if (!drag) return

    if (nextWidth <= SNAP_THRESHOLD) {
      if (!drag.collapsed) {
        drag.collapsed = true
        onCollapsedChange()
      }
      return
    }

    if (drag.collapsed) {
      drag.collapsed = false
      onCollapsedChange()
    }
    onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth)))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return
    event.preventDefault()

    if (event.key === 'Home') {
      if (!collapsed) onCollapsedChange()
      return
    }
    if (event.key === 'End') {
      if (collapsed) onCollapsedChange()
      onWidthChange(DEFAULT_WIDTH)
      return
    }

    const direction = event.key === 'ArrowRight' ? 1 : -1
    const nextWidth = (collapsed ? COLLAPSE_WIDTH : width) + direction * 16
    if (nextWidth <= SNAP_THRESHOLD) {
      if (!collapsed) onCollapsedChange()
      return
    }
    if (collapsed) onCollapsedChange()
    onWidthChange(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth)))
  }

  return (
    <div
      className="sidebar-resizer desktop-only"
      role="separator"
      aria-label={t('调整会话栏宽度', 'Resize conversations sidebar')}
      aria-orientation="vertical"
      aria-valuemin={COLLAPSE_WIDTH}
      aria-valuemax={MAX_WIDTH}
      aria-valuenow={collapsed ? COLLAPSE_WIDTH : width}
      tabIndex={0}
      title={t('拖动调整宽度，双击还原', 'Drag to resize, double-click to reset')}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = { startX: event.clientX, startWidth: collapsed ? COLLAPSE_WIDTH : width, collapsed }
        document.body.style.userSelect = 'none'
        onResizingChange(true)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag) return
        updateWidth(drag.startWidth + event.clientX - drag.startX)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onDoubleClick={() => {
        if (collapsed) onCollapsedChange()
        onWidthChange(DEFAULT_WIDTH)
      }}
      onKeyDown={handleKeyDown}
    >
      <span aria-hidden="true" />
    </div>
  )
}
