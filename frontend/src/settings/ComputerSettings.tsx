import { ComputerPanel } from '@/components/ComputerPanel'
import { SettingSectionLabel } from './SettingControls'
import { ComputerConnectionForm } from './ConnectionForms'
import { useConnections } from './ConnectionProvider'
import { useSettings } from './SettingsProvider'

export function ComputerSettings() {
  const { t } = useSettings()
  const { snapshot } = useConnections()
  return (
    <div className="settings-scroll">
      <ComputerConnectionForm />
      <SettingSectionLabel>{t('Bot 的电脑', "Bot's computer")}</SettingSectionLabel>
      <ComputerPanel key={snapshot?.machineId ?? 'none'} />
    </div>
  )
}
