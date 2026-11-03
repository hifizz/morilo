import { useState, type FormEvent } from 'react'
import { KeyRound, RefreshCw } from 'lucide-react'
import { Button } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import type { IntegrationStore } from './types'

export function IntegrationSetup({ store }: { store: IntegrationStore }) {
  const { t } = useSettings()
  const [editing, setEditing] = useState(false)
  const [apiKey, setAPIKey] = useState('')
  const showForm = store.desktop && (!store.configured || editing)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const key = apiKey
    setAPIKey('')
    if (await store.configure(key)) setEditing(false)
  }

  return (
    <section className="integration-setup" aria-label={t('Composio 连接配置', 'Composio connection setup')}>
      <div className="integration-setup__heading">
        <strong><KeyRound size={15} />Composio</strong>
        <span className={store.configured ? 'integration-configured' : 'integration-muted'}>
          {store.configured ? t('已配置', 'Configured') : t('未配置', 'Not configured')}
        </span>
        <Button variant="ghost" size="sm" disabled={!store.desktop || store.loading || store.busy} onClick={() => void store.refresh()}>
          <RefreshCw size={13} />{store.loading ? t('刷新中…', 'Refreshing…') : t('刷新', 'Refresh')}
        </Button>
        {store.desktop && store.configured && !editing && (
          <Button variant="ghost" size="sm" disabled={store.busy} onClick={() => setEditing(true)}>{t('更换密钥', 'Change key')}</Button>
        )}
      </div>
      {!store.desktop && <p>{t('请在 Grokbot 桌面应用中配置并连接。浏览器预览不会模拟已连接账户。', 'Open the Grokbot desktop app to configure and connect. Browser preview does not simulate connected accounts.')}</p>}
      {showForm && (
        <form onSubmit={(event) => void save(event)}>
          <p>{t('仅填写 Composio 项目 API Key，验证后保存在系统钥匙串。不要填写 GitHub 或 Vercel Token。', 'Enter only your Composio project API key. It is validated and stored in the system keychain. Do not enter a GitHub or Vercel token.')}</p>
          <div className="integration-setup__form">
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setAPIKey(event.target.value)}
              aria-label={t('Composio 项目 API Key', 'Composio project API key')}
              placeholder={t('Composio 项目 API Key', 'Composio project API key')}
              autoComplete="off"
              spellCheck={false}
              disabled={store.busy}
            />
            <Button type="submit" size="sm" disabled={!apiKey.trim() || store.busy}>{store.busy ? t('验证中…', 'Validating…') : t('验证并保存', 'Validate & save')}</Button>
            {editing && <Button variant="ghost" size="sm" disabled={store.busy} onClick={() => { setAPIKey(''); setEditing(false) }}>{t('取消', 'Cancel')}</Button>}
          </div>
          <a href="https://dashboard.composio.dev/login" target="_blank" rel="noopener noreferrer">{t('打开 Composio 控制台', 'Open Composio dashboard')}</a>
        </form>
      )}
    </section>
  )
}

export function IntegrationFeedback({ store }: { store: IntegrationStore }) {
  const { t } = useSettings()
  return (
    <>
      {store.error && (
        <div className="integration-feedback is-error" role="alert">
          <span>{store.error}</span>
          <Button variant="secondary" size="sm" disabled={store.loading || store.busy} onClick={() => void store.refresh()}>{t('重试刷新', 'Retry refresh')}</Button>
        </div>
      )}
      {store.notice && <p className="integration-feedback" role="status">{store.notice}</p>}
    </>
  )
}
