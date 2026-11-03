import { useEffect, useRef, useState } from 'react'
import { Eye, LoaderCircle, Maximize2, Minimize2, Monitor, MousePointer2, RefreshCw } from 'lucide-react'
import { isCallError, isMyGo } from 'mygo-runtime'
import { Button, IconButton } from '@/design-system'
import { useDismissOnEscape } from '@/design-system/useDismissOnEscape'
import { Computer, type ComputerStatus, type ComputerView } from '@/mygo'

export function ComputerPanel({ label }: { label?: string }) {
  const inApp = isMyGo()
  const [status, setStatus] = useState<ComputerStatus | null>(null)
  const [view, setView] = useState<ComputerView | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const viewerRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openRef = useRef<HTMLButtonElement>(null)
  const wasExpandedRef = useRef(false)

  useEffect(() => {
    if (!inApp) return
    Computer.status()
      .then(setStatus)
      .catch((err) => setError(isCallError(err) ? err.message : String(err)))
  }, [inApp])

  const connect = (takeControl = false) => {
    setError('')
    setLoading(true)
    Computer.connect(takeControl)
      .then((next) => {
        setView(next)
        setStatus({ configured: true, id: next.id, name: next.name, state: next.state })
      })
      .catch((err) => setError(isCallError(err) ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  const closeViewer = () => {
    setExpanded(false)
    if (view && !view.viewOnly) void connect(false)
  }
  useDismissOnEscape(expanded, (open) => { if (!open) closeViewer() })

  useEffect(() => {
    const dialog = viewerRef.current!
    dialog.close()
    if (expanded) {
      dialog.showModal()
      closeRef.current?.focus()
    } else {
      dialog.show()
      if (wasExpandedRef.current) requestAnimationFrame(() => openRef.current?.focus())
    }
    wasExpandedRef.current = expanded
  }, [expanded])

  const configured = inApp && status?.configured === true
  const machineLabel = !inApp
    ? '浏览器预览'
    : !status
      ? '…'
      : !status.configured
        ? '未配置'
        : [status.name || status.id, status.state].filter(Boolean).join(' · ')

  const placeholder = !inApp ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>请在桌面应用中连接远程电脑</strong></div>
  ) : !status ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>{error ? '无法获取电脑状态' : '正在获取电脑状态…'}</strong></div>
  ) : !status.configured ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>未配置远程电脑</strong><p className="computer-config">INSTABOX_API_KEY / INSTABOX_MACHINE_ID<br />配置后重启应用；聊天仍使用本机工具。</p></div>
  ) : loading ? (
    <div className="computer-placeholder"><LoaderCircle className="ds-button__spinner" size={30} /><strong>Waking up…</strong><p>正在启动电脑并连接桌面</p></div>
  ) : status.state === 'running' ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>Computer is ready</strong><p>点击连接远程电脑</p><Button size="sm" onClick={() => connect(false)}>连接电脑</Button></div>
  ) : (
    <div className="computer-placeholder"><Monitor size={34} /><span className="computer-zzz">z z</span><strong>Computer is asleep</strong><Button size="sm" onClick={() => connect(false)}>唤醒电脑</Button></div>
  )

  return (
    <>
      <dialog
        open
        ref={viewerRef}
        className={`computer-viewer${expanded ? ' computer-viewer--expanded' : ''}`}
        aria-label={`${label || '共享电脑'} — 远程桌面`}
        aria-modal={expanded || undefined}
        onCancel={(event) => { event.preventDefault(); closeViewer() }}
      >
        <div className="computer-viewer__header" hidden={!expanded}>
          <span className="computer-viewer__title">{label || '共享电脑'}</span>
          <IconButton ref={closeRef} label="返回聊天" onClick={closeViewer}><Minimize2 size={16} /></IconButton>
        </div>
        <div className="computer-viewer__viewport">
          {view ? (
            <>
              <iframe className="computer-frame" src={view.url} title="远程电脑桌面" allowFullScreen referrerPolicy="no-referrer" tabIndex={expanded ? 0 : -1} style={{ pointerEvents: expanded ? 'auto' : 'none' }} />
              {!expanded && <Button className="computer-viewer__open" onClick={() => setExpanded(true)} disabled={loading}><Maximize2 size={14} />Open</Button>}
            </>
          ) : placeholder}
        </div>
        <div className="computer-viewer__footer" hidden={!expanded}>
          {error && <p className="computer-error">{error}</p>}
          <div className="computer-viewer__pill">
            {view?.viewOnly ? <Eye size={13} /> : <MousePointer2 size={13} />}
            <span>{view?.viewOnly ? 'Watching' : 'Controlling'}</span>
            <Button size="sm" loading={loading} disabled={!view} onClick={() => connect(view?.viewOnly ?? false)}>{view?.viewOnly ? 'Take control' : 'Release control'}</Button>
            <IconButton label="刷新连接" onClick={() => connect(!view?.viewOnly)} disabled={!view || loading}><RefreshCw size={14} /></IconButton>
          </div>
        </div>
      </dialog>
      {error && <p className="computer-error">{error}</p>}
      <div className="computer-actions">
        <span className="computer-status">{machineLabel}</span>
        <IconButton label="刷新连接" onClick={() => connect(false)} disabled={!configured || loading}><RefreshCw size={15} /></IconButton>
        {view && <IconButton ref={openRef} label="放大电脑画面" onClick={() => setExpanded(true)} disabled={loading}><Maximize2 size={15} /></IconButton>}
      </div>
      {configured && <p className="computer-caption">{label ? `${label}’s screen · 所有 Bot 共用` : '所有 Bot 共用这台电脑'}</p>}
    </>
  )
}
