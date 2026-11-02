import { useRef, useState } from 'react'
import { Copy, UserRound } from 'lucide-react'
import { Button, Select, Switch } from '@/design-system'
import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'

export function GeneralSettings({ onNotify }: SettingsPageProps) {
  const [addingAccount, setAddingAccount] = useState(false)
  const [spelling, setSpelling] = useState(true)
  const [acceleration, setAcceleration] = useState(true)
  const [securityKey, setSecurityKey] = useState(true)
  const [theme, setTheme] = useState('system')
  const [accent, setAccent] = useState('bot')
  const [language, setLanguage] = useState('system')
  const [microphone, setMicrophone] = useState('default')
  const [timezone, setTimezone] = useState('auto')
  const fileRef = useRef<HTMLInputElement>(null)

  const copyEmail = async () => {
    try { await navigator.clipboard.writeText('276161014@qq.com') } catch { /* Demo remains usable without clipboard permission. */ }
    onNotify('邮箱地址已复制')
  }

  return (
    <div className="settings-scroll">
      <SettingSectionLabel>Account</SettingSectionLabel>
      <SettingCard className="account-card">
        <span className="account-avatar"><UserRound size={23} /></span>
        <div className="account-card__identity"><strong>zilin</strong><span>276161014@qq.com <button type="button" aria-label="复制邮箱" onClick={copyEmail}><Copy size={12} /></button></span></div>
        <Button variant="ghost" size="sm" onClick={() => { setAddingAccount((value) => !value); onNotify(addingAccount ? '已取消添加账户' : '演示版暂不连接真实账户') }}>{addingAccount ? 'Cancel' : 'Add account'}</Button>
        <Button variant="ghost" size="sm" onClick={() => onNotify('演示账号保持登录状态')}>Sign Out</Button>
      </SettingCard>

      <SettingSectionLabel>Appearance</SettingSectionLabel>
      <SettingCard>
        <SettingRow title="Theme"><Select label="主题" value={theme} onValueChange={setTheme} options={[{ value: 'system', label: 'Follow System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} /></SettingRow>
        <SettingRow title="Accent"><Select label="强调色" value={accent} onValueChange={setAccent} options={[{ value: 'bot', label: 'Bot color' }, { value: 'blue', label: 'Blue' }, { value: 'neutral', label: 'Neutral' }]} /></SettingRow>
        <SettingRow title="Language"><Select label="语言" value={language} onValueChange={setLanguage} options={[{ value: 'system', label: 'Follow System' }, { value: 'en', label: 'English' }, { value: 'zh', label: '简体中文' }]} /></SettingRow>
        <SettingRow title="Check Spelling While Typing"><Switch label="输入时检查拼写" checked={spelling} onCheckedChange={setSpelling} /></SettingRow>
      </SettingCard>

      <SettingSectionLabel>System</SettingSectionLabel>
      <SettingCard>
        <SettingRow title="Microphone"><Select label="麦克风" value={microphone} onValueChange={setMicrophone} options={[{ value: 'default', label: 'System Default' }, { value: 'built-in', label: 'Built-in Microphone' }, { value: 'disabled', label: 'Disabled' }]} /></SettingRow>
        <SettingRow title="Use hardware acceleration"><Switch label="硬件加速" checked={acceleration} onCheckedChange={setAcceleration} /></SettingRow>
      </SettingCard>

      <SettingSectionLabel>Bot</SettingSectionLabel>
      <SettingCard><SettingRow title="Timezone"><Select label="时区" value={timezone} onValueChange={setTimezone} options={[{ value: 'auto', label: 'Auto-detect (Asia/Singapore)' }, { value: 'shanghai', label: 'Asia/Shanghai' }, { value: 'utc', label: 'UTC' }]} /></SettingRow></SettingCard>

      <SettingSectionLabel>Import</SettingSectionLabel>
      <SettingCard><SettingRow title="Import Memory to Grok Bot" description="Transfer your preferences and context from another AI assistant"><Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>Start Import</Button></SettingRow></SettingCard>
      <input ref={fileRef} className="visually-hidden" type="file" accept=".txt,.md,.json" onChange={(event) => { if (event.target.files?.[0]) onNotify(`已读取 ${event.target.files[0].name}（演示导入）`) }} />

      <SettingSectionLabel>Security Key</SettingSectionLabel>
      <SettingCard><SettingRow title="Use hardware security keys" description="Allow Grok Bot to use a security key connected to your computer. You'll be asked to approve each use."><Switch label="硬件安全密钥" checked={securityKey} onCheckedChange={setSecurityKey} /></SettingRow></SettingCard>
    </div>
  )
}
