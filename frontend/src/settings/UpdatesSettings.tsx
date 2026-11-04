import { useState } from 'react'
import { Button, Switch } from '@/design-system'
import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'
import { useSettings } from './SettingsProvider'

export function UpdatesSettings({ onNotify }: SettingsPageProps) {
  const { t } = useSettings()
  const [automatic, setAutomatic] = useState(true)
  const [checking, setChecking] = useState(false)

  const check = () => {
    setChecking(true)
    window.setTimeout(() => {
      setChecking(false)
      onNotify(t('Morilo 已是最新版本', 'Morilo is up to date'))
    }, 800)
  }

  return (
    <div className="settings-scroll">
      <SettingSectionLabel>{t('Morilo 更新', 'Morilo Updates')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow title={t('自动更新', 'Automatic Updates')} description={t('在你离开时自动更新客户端', "Automatically update your client while you're away")}><Switch label={t('自动更新', 'Automatic updates')} checked={automatic} onCheckedChange={setAutomatic} /></SettingRow>
        <SettingRow title={t('版本 0.78.1', 'Version 0.78.1')} description={t('已是最新版本', "You're up to date")}><Button variant="secondary" loading={checking} onClick={check}>{t('检查更新', 'Check for Updates')}</Button></SettingRow>
      </SettingCard>
    </div>
  )
}
