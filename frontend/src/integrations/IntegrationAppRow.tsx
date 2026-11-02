import { Check, Users } from 'lucide-react'
import { Button } from '@/design-system'
import { IntegrationIcon } from './IntegrationIcon'
import type { IntegrationApp } from './types'

interface IntegrationAppRowProps {
  app: IntegrationApp
  connected: boolean
  onOpen: () => void
  showCapabilities?: boolean
}

export function IntegrationAppRow({ app, connected, onOpen, showCapabilities = false }: IntegrationAppRowProps) {
  return (
    <div className={`integration-app-row ${connected ? 'is-connected' : ''}`}>
      <button type="button" className="integration-app-row__main" onClick={onOpen} aria-label={`打开 ${app.name} 详情`}>
        <IntegrationIcon icon={app.icon} size={showCapabilities ? 42 : 40} />
        <span className="integration-app-row__copy">
          <span className="integration-app-row__name">
            {app.name}
            {app.team && <span className="integration-team-badge"><Users size={11} />Team</span>}
          </span>
          {showCapabilities && (
            <span className="integration-app-row__meta">
              1 connector{app.skills.length > 0 ? `, ${app.skills.length} ${app.skills.length === 1 ? 'skill' : 'skills'}` : ''}
            </span>
          )}
        </span>
      </button>
      {connected ? (
        <span className="integration-connected"><Check size={13} />Connected</span>
      ) : (
        <Button variant="secondary" size="sm" className="integration-connect-button" onClick={onOpen}>Connect</Button>
      )}
    </div>
  )
}
