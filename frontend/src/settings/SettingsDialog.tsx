import { useState } from 'react'
import { CloudDownload, Computer, Cpu, Settings2 } from 'lucide-react'
import { Dialog } from '@/design-system'
import { ComputerSettings } from './ComputerSettings'
import { GeneralSettings } from './GeneralSettings'
import { ModelSettings } from './ModelSettings'
import { UpdatesSettings } from './UpdatesSettings'
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
  { id: 'model', zh: '模型', en: 'Model', icon: Cpu },
  { id: 'computer', zh: '电脑', en: 'Computer', icon: Computer },
  { id: 'updates', zh: '关于与下载', en: 'About & downloads', icon: CloudDownload },
] as const

export function SettingsDialog({ initialSection, onClose, onNotify }: SettingsDialogProps) {
  const { t } = useSettings()
  const [section, setSection] = useState<SettingsSection>(initialSection)
  const [prevInitial, setPrevInitial] = useState(initialSection)
  if (prevInitial !== initialSection) { setPrevInitial(initialSection); setSection(initialSection) }
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
          <header className="settings-content__header"><h2>{titles[section]}</h2></header>
          {section === 'general' && <GeneralSettings onNotify={onNotify} />}
          {section === 'model' && <ModelSettings />}
          {section === 'computer' && <ComputerSettings />}
          {section === 'updates' && <UpdatesSettings />}
        </main>
      </div>
    </Dialog>
  )
}
