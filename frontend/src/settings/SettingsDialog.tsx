import { useEffect, useState } from 'react'
import { BarChart3, CloudDownload, Computer, Settings2, ShieldCheck, SquareArrowOutUpRight } from 'lucide-react'
import { Dialog } from '@/design-system'
import { BillingSettings } from './BillingSettings'
import { ComputerSettings } from './ComputerSettings'
import { GeneralSettings } from './GeneralSettings'
import { PermissionsSettings } from './PermissionsSettings'
import { UpdatesSettings } from './UpdatesSettings'
import { VaultSettings } from './VaultSettings'
import type { SettingsSection } from './types'
import './settings.css'

interface SettingsDialogProps {
  initialSection: SettingsSection
  onClose: () => void
  onNotify: (message: string) => void
}

const navigation = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'computer', label: 'Computer', icon: Computer },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
  { id: 'vault', label: 'Vault', icon: SquareArrowOutUpRight },
  { id: 'billing', label: 'Usage & Billing', icon: BarChart3 },
  { id: 'updates', label: 'Updates', icon: CloudDownload },
] as const

const titles: Record<SettingsSection, string> = { general: 'General', computer: 'Computer', permissions: 'Permissions', vault: 'Vault', billing: 'Usage & Billing', updates: 'Updates' }

export function SettingsDialog({ initialSection, onClose, onNotify }: SettingsDialogProps) {
  const [section, setSection] = useState<SettingsSection>(initialSection)
  useEffect(() => setSection(initialSection), [initialSection])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title="Grok Bot Settings" hideHeader className="settings-dialog">
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置导航">
          {navigation.map((item) => {
            const Icon = item.icon
            return <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}><Icon size={17} /><span>{item.label}</span></button>
          })}
        </nav>
        <main className="settings-content">
          <header className="settings-content__header"><h2>{titles[section]}</h2>{section === 'vault' && <span className="settings-header-spacer" />}</header>
          {section === 'general' && <GeneralSettings onNotify={onNotify} />}
          {section === 'computer' && <ComputerSettings onNotify={onNotify} />}
          {section === 'permissions' && <PermissionsSettings onNotify={onNotify} />}
          {section === 'vault' && <VaultSettings onNotify={onNotify} />}
          {section === 'billing' && <BillingSettings onNotify={onNotify} />}
          {section === 'updates' && <UpdatesSettings onNotify={onNotify} />}
        </main>
      </div>
    </Dialog>
  )
}
