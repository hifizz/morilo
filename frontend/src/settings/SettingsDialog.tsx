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
import { useSettings } from './SettingsProvider'
import './settings.css'

interface SettingsDialogProps {
  initialSection: SettingsSection
  onClose: () => void
  onNotify: (message: string) => void
}

const navigation = [
  { id: 'general', zh: '通用', en: 'General', icon: Settings2 },
  { id: 'computer', zh: '电脑', en: 'Computer', icon: Computer },
  { id: 'permissions', zh: '权限', en: 'Permissions', icon: ShieldCheck },
  { id: 'vault', zh: '保险库', en: 'Vault', icon: SquareArrowOutUpRight },
  { id: 'billing', zh: '用量与账单', en: 'Usage & Billing', icon: BarChart3 },
  { id: 'updates', zh: '更新', en: 'Updates', icon: CloudDownload },
] as const

export function SettingsDialog({ initialSection, onClose, onNotify }: SettingsDialogProps) {
  const { t } = useSettings()
  const [section, setSection] = useState<SettingsSection>(initialSection)
  useEffect(() => setSection(initialSection), [initialSection])
  const titles: Record<SettingsSection, string> = Object.fromEntries(navigation.map((n) => [n.id, t(n.zh, n.en)])) as Record<SettingsSection, string>

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={t('Morilo 设置', 'Morilo Settings')} closeLabel={t('关闭', 'Close')} hideHeader className="settings-dialog">
      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('设置导航', 'Settings navigation')}>
          {navigation.map((item) => {
            const Icon = item.icon
            return <button type="button" key={item.id} className={section === item.id ? 'is-active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}><Icon size={17} /><span>{t(item.zh, item.en)}</span></button>
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
