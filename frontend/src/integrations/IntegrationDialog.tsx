import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Dialog, IconButton } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import { AppDetails } from './AppDetails'
import { AppDirectory } from './AppDirectory'
import { integrationApps } from './data'
import { ManagePlugins } from './ManagePlugins'
import { SkillEditor } from './SkillEditor'
import type { IntegrationStore } from './types'
import './integrations.css'

type IntegrationRoute =
  | { view: 'directory' }
  | { view: 'manage' }
  | { view: 'app'; appId: string; from: 'directory' | 'manage' }
  | { view: 'skill'; skillId: string }

interface IntegrationDialogProps {
  store: IntegrationStore
  onClose: () => void
}

export function IntegrationDialog({ store, onClose }: IntegrationDialogProps) {
  const { t } = useSettings()
  const [route, setRoute] = useState<IntegrationRoute>({ view: 'directory' })
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)

  const notify = useCallback((message: string) => {
    setNotice(message)
    window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200)
  }, [])

  useEffect(() => () => window.clearTimeout(noticeTimer.current), [])

  const selectedApp = route.view === 'app' ? integrationApps.find((app) => app.id === route.appId) : undefined
  const selectedSkill = route.view === 'skill' ? store.privateSkills.find((skill) => skill.id === route.skillId) : undefined
  const title = route.view === 'directory'
    ? t('连接应用', 'Connect Apps')
    : route.view === 'manage'
      ? t('管理连接与本地技能', 'Manage connections and local skills')
      : selectedApp?.name ?? selectedSkill?.name ?? t('集成', 'Integration')

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={title} hideHeader hideCloseButton className="integration-dialog">
      <IconButton label={t('关闭', 'Close')} className="ds-dialog__floating-close" onClick={onClose}><X size={19} /></IconButton>
      {route.view === 'directory' && (
        <AppDirectory
          store={store}
          onOpenManage={() => setRoute({ view: 'manage' })}
          onOpenApp={(appId) => setRoute({ view: 'app', appId, from: 'directory' })}
        />
      )}
      {route.view === 'manage' && (
        <ManagePlugins
          store={store}
          onBack={() => setRoute({ view: 'directory' })}
          onOpenApp={(appId) => setRoute({ view: 'app', appId, from: 'manage' })}
          onOpenSkill={(skillId) => setRoute({ view: 'skill', skillId })}
        />
      )}
      {route.view === 'app' && selectedApp && (
        <AppDetails
          key={selectedApp.id}
          app={selectedApp}
          store={store}
          onBack={() => setRoute({ view: route.from })}
          onNotify={notify}
        />
      )}
      {route.view === 'skill' && selectedSkill && (
        <SkillEditor
          key={selectedSkill.id}
          skill={selectedSkill}
          onBack={() => setRoute({ view: 'manage' })}
          onSave={store.savePrivateSkill}
          onDelete={(id) => { store.deletePrivateSkill(id); setRoute({ view: 'manage' }) }}
          onNotify={notify}
        />
      )}
      <div className={`integration-notice ${notice ? 'is-visible' : ''}`} role="status" aria-live="polite">
        <Check size={15} />
        <span>{notice}</span>
        <IconButton label={t('关闭通知', 'Dismiss notification')} onClick={() => setNotice('')}><X size={14} /></IconButton>
      </div>
    </Dialog>
  )
}
