import { useEffect, useRef, useState } from 'react'
import { Eye, LoaderCircle, Maximize2, Minimize2, Monitor, MousePointer2, RefreshCw } from 'lucide-react'
import { isCallError, isMyGo } from 'mygo-runtime'
import { Button, IconButton } from '@/design-system'
import { useDismissOnEscape } from '@/design-system/useDismissOnEscape'
import { Computer, type ComputerStatus, type ComputerView } from '@/mygo'
import { useConnections } from '@/settings/ConnectionProvider'
import { useSettings } from '@/settings/SettingsProvider'

const stateLabels: Record<string, [string, string]> = {
  running: ['运行中', 'Running'],
  stopped: ['已停止', 'Stopped'],
  sleeping: ['休眠中', 'Sleeping'],
  starting: ['启动中', 'Starting'],
  stopping: ['停止中', 'Stopping'],
  paused: ['已暂停', 'Paused'],
  unknown: ['未知状态', 'Unknown state'],
}

export function ComputerPanel({ label }: { label?: string }) {
  const { t } = useSettings()
  const { snapshot } = useConnections()
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
  const generation = useRef(0)

  // A machine change invalidates any open view/status of the old one.
  const machineId = snapshot?.machineId
  const [prevMachine, setPrevMachine] = useState(machineId)
  if (prevMachine !== machineId) {
    setPrevMachine(machineId)
    setView(null)
    setStatus(null)
    setError('')
  }
  useEffect(() => {
    if (!inApp) return
    const gen = ++generation.current
    Computer.status()
      .then((next) => { if (gen === generation.current) setStatus(next) })
      .catch((err) => { if (gen === generation.current) setError(isCallError(err) ? err.message : String(err)) })
    return () => { generation.current += 1 }
  }, [inApp, machineId])

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
    ? t('浏览器预览', 'Browser preview')
    : !status
      ? '…'
      : !status.configured
        ? t('未配置', 'Not configured')
        : [status.name || status.id, stateLabels[status.state] ? t(...stateLabels[status.state]) : status.state].filter(Boolean).join(' · ')

  const placeholder = !inApp ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>{t('请在桌面应用中连接远程电脑', 'Connect to a remote computer in the desktop app')}</strong></div>
  ) : !status ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>{error ? t('无法获取电脑状态', 'Could not get computer status') : t('正在获取电脑状态…', 'Getting computer status…')}</strong></div>
  ) : !status.configured ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>{t('未配置远程电脑', 'Remote computer not configured')}</strong><p className="computer-config">{t('请在 Settings → Computer 中连接你的 Instabox 电脑。', 'Connect your Instabox machine in Settings → Computer.')}</p></div>
  ) : loading ? (
    <div className="computer-placeholder"><LoaderCircle className="ds-button__spinner" size={30} /><strong>{t('正在唤醒…', 'Waking up…')}</strong><p>{t('正在启动电脑并连接桌面', 'Starting the computer and connecting to its desktop')}</p></div>
  ) : status.state === 'running' ? (
    <div className="computer-placeholder"><Monitor size={34} /><strong>{t('电脑已就绪', 'Computer is ready')}</strong><p>{t('点击连接远程电脑', 'Click to connect to the remote computer')}</p><Button size="sm" onClick={() => connect(false)}>{t('连接电脑', 'Connect computer')}</Button></div>
  ) : (
    <div className="computer-placeholder"><Monitor size={34} /><span className="computer-zzz">z z</span><strong>{t('电脑正在休眠', 'Computer is asleep')}</strong><Button size="sm" onClick={() => connect(false)}>{t('唤醒电脑', 'Wake computer')}</Button></div>
  )

  return (
    <>
      <dialog
        open
        ref={viewerRef}
        className={`computer-viewer${expanded ? ' computer-viewer--expanded' : ''}`}
        aria-label={t(`${label || t('共享电脑', 'Shared computer')} — 远程桌面`, `${label || t('共享电脑', 'Shared computer')} — Remote desktop`)}
        aria-modal={expanded || undefined}
        onCancel={(event) => { event.preventDefault(); closeViewer() }}
      >
        <div className="computer-viewer__header" hidden={!expanded}>
          <span className="computer-viewer__title">{label || t('共享电脑', 'Shared computer')}</span>
          <IconButton ref={closeRef} label={t('返回聊天', 'Back to chat')} onClick={closeViewer}><Minimize2 size={16} /></IconButton>
        </div>
        <div className="computer-viewer__viewport">
          {view ? (
            <>
              <iframe className="computer-frame" src={view.url} title={t('远程电脑桌面', 'Remote computer desktop')} allowFullScreen referrerPolicy="no-referrer" tabIndex={expanded ? 0 : -1} style={{ pointerEvents: expanded ? 'auto' : 'none' }} />
              {!expanded && <Button className="computer-viewer__open" onClick={() => setExpanded(true)} disabled={loading}><Maximize2 size={14} />{t('打开', 'Open')}</Button>}
            </>
          ) : placeholder}
        </div>
        <div className="computer-viewer__footer" hidden={!expanded}>
          {error && <p className="computer-error">{error}</p>}
          <div className="computer-viewer__pill">
            {view?.viewOnly ? <Eye size={13} /> : <MousePointer2 size={13} />}
            <span>{view?.viewOnly ? t('查看中', 'Watching') : t('控制中', 'Controlling')}</span>
            <Button size="sm" loading={loading} disabled={!view} onClick={() => connect(view?.viewOnly ?? false)}>{view?.viewOnly ? t('接管控制', 'Take control') : t('释放控制', 'Release control')}</Button>
            <IconButton label={t('刷新连接', 'Refresh connection')} onClick={() => connect(!view?.viewOnly)} disabled={!view || loading}><RefreshCw size={14} /></IconButton>
          </div>
        </div>
      </dialog>
      {error && <p className="computer-error">{error}</p>}
      <div className="computer-actions">
        <span className="computer-status">{machineLabel}</span>
        <IconButton label={t('刷新连接', 'Refresh connection')} onClick={() => connect(false)} disabled={!configured || loading}><RefreshCw size={15} /></IconButton>
        {view && <IconButton ref={openRef} label={t('放大电脑画面', 'Expand computer view')} onClick={() => setExpanded(true)} disabled={loading}><Maximize2 size={15} /></IconButton>}
      </div>
      {configured && <p className="computer-caption">{label ? t(`${label} 的屏幕 · 所有 Bot 共用`, `${label}’s screen · Shared by all bots`) : t('所有 Bot 共用这台电脑', 'All bots share this computer')}</p>}
    </>
  )
}
