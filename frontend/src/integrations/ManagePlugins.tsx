import { useState } from 'react'
import { ChevronLeft, FileText } from 'lucide-react'
import { IconButton } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import { integrationApps } from './data'
import { IntegrationAppRow } from './IntegrationAppRow'
import { IntegrationFeedback } from './IntegrationSetup'
import type { IntegrationApp, IntegrationStore } from './types'

interface ManagePluginsProps {
  store: IntegrationStore
  onBack: () => void
  onOpenApp: (id: string) => void
  onOpenSkill: (id: string) => void
}

export function ManagePlugins({ store, onBack, onOpenApp, onOpenSkill }: ManagePluginsProps) {
  const { t } = useSettings()
  const [showAll, setShowAll] = useState(false)
  const installedApps = store.installedIds
    .map((id) => integrationApps.find((app) => app.id === id))
    .filter((app): app is IntegrationApp => Boolean(app))
  const visibleApps = showAll ? installedApps : installedApps.slice(0, 6)

  return (
    <div className="integration-manage">
      <header className="integration-subheader integration-manage__header">
        <IconButton label={t('返回连接应用', 'Back to Connect Apps')} onClick={onBack}><ChevronLeft size={20} /></IconButton>
        <span>{t('连接应用', 'Connect Apps')}</span>
      </header>
      <div className="integration-scroll integration-manage__scroll">
        <IntegrationFeedback store={store} />
        <h2>{t('管理连接与本地技能', 'Manage connections and local skills')}</h2>
        <section className="integration-manage-section">
          <h3>{t('已有连接', 'Existing connections')}</h3>
          {installedApps.length === 0 && <p className="integration-muted">{t('暂无连接。请返回选择 GitHub 或 Vercel。', 'No connections yet. Go back to choose GitHub or Vercel.')}</p>}
          <div className="integration-app-grid">
            {visibleApps.map((app) => (
              <IntegrationAppRow
                key={app.id}
                app={app}
                connected={store.connectedIds.includes(app.id)}
                onOpen={() => onOpenApp(app.id)}
                showCapabilities
              />
            ))}
          </div>
          {installedApps.length > 6 && (
            <button type="button" className="integration-show-all" onClick={() => setShowAll((value) => !value)}>
              {showAll ? t('收起应用', 'Show fewer apps') : t(`查看全部 ${installedApps.length} 个应用`, `Show all ${installedApps.length} apps`)}
            </button>
          )}
        </section>

        <section className="integration-manage-section integration-private-skills">
          <h3>{t('本地技能（演示）', 'Local skills (demo)')}</h3>
          <p className="integration-muted">{t('仅供本地编辑，不会安装到 Pi。', 'Local editing only; these are not installed into Pi.')}</p>
          <div className="integration-private-skill-list">
            {store.privateSkills.map((skill) => (
              <button type="button" className="integration-private-skill" key={skill.id} onClick={() => onOpenSkill(skill.id)}>
                <span className="integration-private-skill__icon"><FileText size={19} /></span>
                <span className="integration-private-skill__copy">
                  <strong>{skill.name}</strong>
                  <span>{t('本地创建', 'Created locally')} · {skill.description}</span>
                </span>
              </button>
            ))}
            {store.privateSkills.length === 0 && <p className="integration-muted">{t('暂无本地技能。', 'No local skills yet.')}</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
