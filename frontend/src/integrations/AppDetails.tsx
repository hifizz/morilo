import {
  Box,
  ChevronLeft,
  Link,
  RefreshCw,
} from 'lucide-react'
import { Button, IconButton } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import { IntegrationIcon } from './IntegrationIcon'
import { IntegrationFeedback, IntegrationSetup } from './IntegrationSetup'
import { integrationCapabilityLabel, integrationCategoryLabel, integrationStatusLabel } from './presentation'
import type { IntegrationApp, IntegrationStore } from './types'

interface AppDetailsProps {
  app: IntegrationApp
  store: IntegrationStore
  onBack: () => void
  onNotify: (message: string) => void
}

export function AppDetails({ app, store, onBack, onNotify }: AppDetailsProps) {
  const { profile, t } = useSettings()
  const connected = store.connectedIds.includes(app.id)
  const accounts = store.connections.filter((connection) => connection.appId === app.id)

  const disconnect = async (accountId: string) => {
    const confirmed = window.confirm(t(
      `从本地用户「${profile?.name ?? ''}」解除此 ${app.name} 连接？此操作不可撤销，不会删除上游账户或撤销上游 Token。可以之后重新连接。`,
      `Unlink this ${app.name} connection from local profile “${profile?.name ?? ''}”? This cannot be undone. It does not delete the upstream account or revoke its token. You can reconnect later.`,
    ))
    if (confirmed && await store.disconnect(accountId)) onNotify(t('已解除连接。', 'Connection unlinked.'))
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`https://${app.website}`)
      onNotify(t('已复制网站链接。', 'Website link copied.'))
    } catch {
      // Clipboard may be unavailable in a sandboxed preview.
      onNotify(t('无法复制网站链接。', 'Could not copy website link.'))
    }
  }

  return (
    <div className="integration-details">
      <header className="integration-subheader">
        <IconButton label={t('返回连接应用', 'Back to Connect Apps')} onClick={onBack}><ChevronLeft size={20} /></IconButton>
        <h2>{app.name}</h2>
      </header>

      <div className="integration-scroll integration-details__scroll">
        <IntegrationFeedback store={store} />
        <section className="integration-app-hero">
          <div className="integration-app-hero__top">
            <div className="integration-app-hero__identity">
              <IntegrationIcon icon={app.icon} size={58} />
              <h3>{app.name}</h3>
            </div>
            <div className="integration-app-hero__actions">
              <Button variant="secondary" onClick={() => void share()}><Link size={15} />{t('复制网站', 'Copy website')}</Button>
              <Button
                onClick={() => void store.connect(app.id)}
                disabled={!app.available || !store.desktop || !store.configured || store.busy || store.loading || connected}
              >
                {!app.available ? t('尚未接入', 'Coming soon') : connected ? t('已连接', 'Connected') : store.busy ? t('处理中…', 'Working…') : accounts.length ? t('重新连接', 'Reconnect') : t('连接', 'Connect')}
              </Button>
            </div>
          </div>
          <p>{!app.available ? t('此应用尚未接入，当前无法安装或连接。', 'This app is coming soon and cannot be installed or connected yet.') : app.id === 'github' ? t('读取已授权可见的账户资料、仓库和议题。', app.description) : t('读取项目和部署。', app.description)}</p>
        </section>

        {app.available && (
          <>
            <p className="integration-readonly">
              {t(
                'Grokbot 仅开放只读工具，不会创建或修改仓库、议题、项目或部署。GitHub 默认只申请 read:user，不请求私有仓库权限；实际可见资源取决于账户已有授权。Vercel Token 在 Composio 授权页输入并由 Composio 保存，其原始权限由该 Token 决定。',
                'Grokbot exposes read-only tools only; it cannot create or modify repositories, issues, projects, or deployments. GitHub requests only read:user by default, not private-repository access; visible resources depend on existing account grants. Enter your Vercel token on the Composio authorization page. Composio stores it, and its original permissions are determined by that token.',
              )}
            </p>
            {(!store.configured || !store.desktop) && <IntegrationSetup store={store} />}
          </>
        )}

        {app.available && (
          <section className="integration-detail-section">
            <div className="integration-section__heading">
              <h3>{t('当前本地用户的连接', 'Connections for this local profile')}</h3>
              <Button variant="ghost" size="sm" disabled={!store.desktop || store.loading || store.busy} onClick={() => void store.refresh()}><RefreshCw size={13} />{t('刷新', 'Refresh')}</Button>
            </div>
            {!accounts.length && <p className="integration-muted">{store.loading ? t('读取状态中…', 'Reading status…') : t('尚无连接。授权完成后请返回刷新。', 'No connections yet. Return and refresh after authorization.')}</p>}
            <div className="integration-panel integration-accounts">
              {accounts.map((account) => (
                <div className="integration-account" key={account.id}>
                  <div className="integration-account__copy">
                    <strong>{account.label || app.name}</strong>
                    <span>{account.id}</span>
                  </div>
                  <span className={account.status === 'ACTIVE' ? 'integration-account-status is-connected' : 'integration-account-status'}>
                    {integrationStatusLabel(account.status, t)}
                  </span>
                  <Button variant="secondary" size="sm" disabled={store.busy || store.loading} onClick={() => void disconnect(account.id)}>{t('解除连接', 'Disconnect')}</Button>
                </div>
              ))}
            </div>
            {accounts.filter((account) => account.status === 'ACTIVE').length > 1 && <p className="integration-muted">{t('读取工具使用列表中的首个有效连接。', 'Read tools use the first active connection in this list.')}</p>}
          </section>
        )}

        {app.available && (
          <section className="integration-detail-section">
            <h3>{t('只读能力', 'Read-only capabilities')} <span>{app.skills.length}</span></h3>
            <div className="integration-panel integration-skills">
              {app.skills.map((skill) => (
                <div className="integration-skill-row" key={skill.id}>
                  <Box size={17} />
                  <div><strong>{integrationCapabilityLabel(skill.id, t)}</strong><span>{skill.id}</span></div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="integration-detail-section">
          <h3>{t('信息', 'Information')}</h3>
          <dl className="integration-panel integration-information">
            <div><dt>{t('开发者', 'Developer')}</dt><dd>{app.developer}</dd></div>
            <div><dt>{t('分类', 'Category')}</dt><dd>{integrationCategoryLabel(app.category, t)}</dd></div>
            <div><dt>{t('网站', 'Website')}</dt><dd>{app.website}</dd></div>
            <div><dt>{t('可用性', 'Availability')}</dt><dd>{app.available ? t('只读连接', 'Read-only connection') : t('尚未接入', 'Coming soon')}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  )
}
