import { useEffect, useRef } from 'react'
import { useSettings } from '@/settings/SettingsProvider'

const MIN_WIDTH = 280
const DEFAULT_WIDTH = 420

interface InspectorResizerProps {
  width: number
  sidebarWidth: number
  onWidthChange: (width: number) => void
  onResizingChange: (resizing: boolean) => void
}

const getMaxWidth = (sidebarWidth: number) => Math.max(MIN_WIDTH, window.innerWidth - sidebarWidth - 320)

export function InspectorResizer({ width, sidebarWidth, onWidthChange, onResizingChange }: InspectorResizerProps) {
  const { t } = useSettings()
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useEffect(() => () => {
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }, [])

  const clamp = (value: number) => Math.min(getMaxWidth(sidebarWidth), Math.max(MIN_WIDTH, value))
  const setWidth = (value: number) => onWidthChange(clamp(value))

  const stopDragging = () => {
    if (!dragRef.current) return
    dragRef.current = null
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    onResizingChange(false)
  }

  return (
    <div
      className="inspector-resizer desktop-only"
      role="separator"
      aria-label={t('调整右侧面板宽度', 'Resize details panel')}
      aria-orientation="vertical"
      aria-controls="agent-inspector"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={getMaxWidth(sidebarWidth)}
      aria-valuenow={clamp(width)}
      tabIndex={0}
      title={t('拖动调整宽度，双击还原', 'Drag to resize, double-click to reset')}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragRef.current = { startX: event.clientX, startWidth: event.currentTarget.parentElement!.getBoundingClientRect().width }
        document.body.style.userSelect = 'none'
        document.body.style.cursor = 'col-resize'
        onResizingChange(true)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag) return
        setWidth(drag.startWidth + drag.startX - event.clientX)
      }}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onLostPointerCapture={stopDragging}
      onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          setWidth(clamp(width) + 16)
        } else if (event.key === 'ArrowRight') {
          event.preventDefault()
          setWidth(clamp(width) - 16)
        } else if (event.key === 'Home') {
          event.preventDefault()
          setWidth(MIN_WIDTH)
        } else if (event.key === 'End') {
          event.preventDefault()
          setWidth(getMaxWidth(sidebarWidth))
        }
      }}
    >
      <span aria-hidden="true" />
    </div>
  )
}
