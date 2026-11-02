import { useState } from 'react'
import { ChevronLeft, FileText } from 'lucide-react'
import { IconButton } from '@/design-system'
import { integrationApps } from './data'
import { IntegrationAppRow } from './IntegrationAppRow'
import type { IntegrationApp, IntegrationStore } from './types'

interface ManagePluginsProps {
  store: IntegrationStore
  onBack: () => void
  onOpenApp: (id: string) => void
  onOpenSkill: (id: string) => void
}

export function ManagePlugins({ store, onBack, onOpenApp, onOpenSkill }: ManagePluginsProps) {
  const [showAll, setShowAll] = useState(false)
  const installedApps = store.installedIds
    .map((id) => integrationApps.find((app) => app.id === id))
    .filter((app): app is IntegrationApp => Boolean(app))
  const visibleApps = showAll ? installedApps : installedApps.slice(0, 6)

  return (
    <div className="integration-manage">
      <header className="integration-subheader integration-manage__header">
        <IconButton label="Back to Connect Apps" onClick={onBack}><ChevronLeft size={20} /></IconButton>
        <span>Connect Apps</span>
      </header>
      <div className="integration-scroll integration-manage__scroll">
        <h2>Manage plugins and skills</h2>
        <section className="integration-manage-section">
          <h3>Installed</h3>
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
              {showAll ? 'Show fewer plugins' : `Show all ${installedApps.length} plugins`}
            </button>
          )}
        </section>

        <section className="integration-manage-section integration-private-skills">
          <h3>Private skills</h3>
          <div className="integration-private-skill-list">
            {store.privateSkills.map((skill) => (
              <button type="button" className="integration-private-skill" key={skill.id} onClick={() => onOpenSkill(skill.id)}>
                <span className="integration-private-skill__icon"><FileText size={19} /></span>
                <span className="integration-private-skill__copy">
                  <strong>{skill.name}</strong>
                  <span>Created locally · {skill.description}</span>
                </span>
              </button>
            ))}
            {store.privateSkills.length === 0 && <p className="integration-muted">No private skills yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
