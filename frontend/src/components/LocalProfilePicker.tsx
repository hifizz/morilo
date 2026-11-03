import { useState } from 'react'
import { UserRound } from 'lucide-react'
import { Button, TextField } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import type { LocalProfile } from '@/mygo'

export function LocalProfilePicker() {
  const { snapshot, t, selectProfile, createProfile } = useSettings()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const profiles = snapshot?.profiles ?? []

  const pick = async (p: LocalProfile) => {
    setError('')
    try {
      await selectProfile(p.id)
    } catch (err) {
      setError(String(err))
    }
  }
  const add = async () => {
    setError('')
    try {
      await createProfile(name, email)
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="profile-picker">
      <div className="profile-picker__card">
        <h1>{t('选择本地资料', 'Choose a local profile')}</h1>
        <p>{t('Grok Bot 使用本机资料记录，不连接云端账户', 'Grok Bot uses local profiles on this device — no cloud account')}</p>
        {error && <p className="settings-error">{error}</p>}
        <div className="profile-picker__list">
          {profiles.map((p) => (
            <button key={p.id} type="button" className="profile-picker__item" onClick={() => void pick(p)}>
              <span className="account-avatar"><UserRound size={18} /></span>
              <span><strong>{p.name}</strong><small>{p.email || t('本地资料', 'Local profile')}</small></span>
            </button>
          ))}
        </div>
        <div className="profile-picker__new">
          <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder={t('新本地资料名称', 'New local profile name')} aria-label={t('新本地资料名称', 'New local profile name')} spellCheck={snapshot?.preferences.spellcheck ?? true} />
          <TextField value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('邮箱（可选）', 'Email (optional)')} aria-label={t('邮箱（可选）', 'Email (optional)')} spellCheck={false} />
          <Button onClick={() => void add()} disabled={!name.trim()}>{t('创建本地资料', 'Create local profile')}</Button>
        </div>
      </div>
    </div>
  )
}
