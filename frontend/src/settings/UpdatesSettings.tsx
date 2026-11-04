import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import { useSettings } from './SettingsProvider'
import { version } from '../../../package.json'

export function UpdatesSettings() {
  const { t } = useSettings()
  return (
    <div className="settings-scroll">
      <SettingSectionLabel>{t('Morilo 更新', 'Morilo Updates')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow
          title={t(`版本 ${version}`, `Version ${version}`)}
          description={t('从 GitHub Releases 下载更新；暂未启用自动更新。', 'Download updates from GitHub Releases; automatic updates are not enabled')}
        >
          <a className="settings-link" href="https://github.com/hifizz/morilo/releases" target="_blank" rel="noopener noreferrer">{t('发布页', 'Releases')}</a>
        </SettingRow>
      </SettingCard>
    </div>
  )
}
