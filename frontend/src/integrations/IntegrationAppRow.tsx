import { Check, Users } from 'lucide-react'
import { Button } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import { IntegrationIcon } from './IntegrationIcon'
import type { IntegrationApp } from './types'

interface IntegrationAppRowProps {
  app: IntegrationApp
  connected: boolean
  onOpen: () => void
  showCapabilities?: boolean
}

export function IntegrationAppRow({ app, connected, onOpen, showCapabilities = false }: IntegrationAppRowProps) {
  const { t } = useSettings()
  return (
    <div className={`integration-app-row ${connected ? 'is-connected' : ''}`}>
      <button type="button" className="integration-app-row__main" onClick={onOpen} aria-label={t(`打开 ${app.name} 详情`, `Open ${app.name} details`)}>
        <IntegrationIcon icon={app.icon} size={showCapabilities ? 42 : 40} />
        <span className="integration-app-row__copy">
          <span className="integration-app-row__name">
            {app.name}
            {app.team && <span className="integration-team-badge"><Users size={11} />{t('团队', 'Team')}</span>}
          </span>
          {showCapabilities && (
            <span className="integration-app-row__meta">
              {app.available ? t(`${app.skills.length} 项只读能力`, `${app.skills.length} read-only capabilities`) : t('尚未接入', 'Coming soon')}
            </span>
          )}
        </span>
      </button>
      {!app.available ? (
        <Button variant="secondary" size="sm" disabled>{t('尚未接入', 'Coming soon')}</Button>
      ) : connected ? (
        <span className="integration-connected"><Check size={13} />{t('已连接', 'Connected')}</span>
      ) : (
        <Button variant="secondary" size="sm" className="integration-connect-button" onClick={onOpen}>{t('连接', 'Connect')}</Button>
      )}
    </div>
  )
}
