import { ComputerPanel } from '@/components/ComputerPanel'
import { SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'
import { useSettings } from './SettingsProvider'

export function ComputerSettings(_props: SettingsPageProps) {
  const { t } = useSettings()
  return (
    <div className="settings-scroll">
      <SettingSectionLabel>{t('Bot 的电脑', "Bot's computer")}</SettingSectionLabel>
      <ComputerPanel />
    </div>
  )
}
