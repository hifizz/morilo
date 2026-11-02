import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Dialog, IconButton } from '@/design-system'
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
    ? 'Connect Apps'
    : route.view === 'manage'
      ? 'Manage plugins and skills'
      : selectedApp?.name ?? selectedSkill?.name ?? 'Integration'

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={title} hideHeader className="integration-dialog">
      {route.view === 'directory' && (
        <AppDirectory
          connectedIds={store.connectedIds}
          onOpenManage={() => setRoute({ view: 'manage' })}
          onOpenApp={(appId) => setRoute({ view: 'app', appId, from: 'directory' })}
          onNotify={notify}
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
        <IconButton label="关闭通知" onClick={() => setNotice('')}><X size={14} /></IconButton>
      </div>
    </Dialog>
  )
}
