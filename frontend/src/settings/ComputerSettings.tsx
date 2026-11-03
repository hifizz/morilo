import { ComputerPanel } from '@/components/ComputerPanel'
import { SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'

export function ComputerSettings(_props: SettingsPageProps) {
  return (
    <div className="settings-scroll">
      <SettingSectionLabel>Bot's computer</SettingSectionLabel>
      <ComputerPanel />
    </div>
  )
}
