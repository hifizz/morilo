import { useState } from 'react'
import { Button, Switch } from '@/design-system'
import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'

export function UpdatesSettings({ onNotify }: SettingsPageProps) {
  const [automatic, setAutomatic] = useState(true)
  const [checking, setChecking] = useState(false)

  const check = () => {
    setChecking(true)
    window.setTimeout(() => {
      setChecking(false)
      onNotify('Grok Bot 已是最新版本')
    }, 800)
  }

  return (
    <div className="settings-scroll">
      <SettingSectionLabel>Grok Bot Updates</SettingSectionLabel>
      <SettingCard>
        <SettingRow title="Automatic Updates" description="Automatically update your client while you're away"><Switch label="自动更新" checked={automatic} onCheckedChange={setAutomatic} /></SettingRow>
        <SettingRow title="Version 0.78.1" description="You're up to date"><Button variant="secondary" loading={checking} onClick={check}>Check for Updates</Button></SettingRow>
      </SettingCard>
    </div>
  )
}
