import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Check,
  ChevronLeft,
  Link,
  Plug,
  Plus,
  SquareArrowOutUpRight,
} from 'lucide-react'
import { Button, IconButton } from '@/design-system'
import { IntegrationIcon } from './IntegrationIcon'
import type { IntegrationApp, IntegrationStore } from './types'

interface IntegrationAccount {
  id: string
  label: string
  status: 'pending' | 'connected'
}

interface AppDetailsProps {
  app: IntegrationApp
  store: IntegrationStore
  onBack: () => void
  onNotify: (message: string) => void
}

export function AppDetails({ app, store, onBack, onNotify }: AppDetailsProps) {
  const installed = store.installedIds.includes(app.id)
  const connected = store.connectedIds.includes(app.id)
  const [installing, setInstalling] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [accountLabel, setAccountLabel] = useState('')
  const [accounts, setAccounts] = useState<IntegrationAccount[]>(() => (
    installed ? [{ id: 'default', label: 'default', status: connected ? 'connected' : 'pending' }] : []
  ))
  const timers = useRef<number[]>([])

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const schedule = (callback: () => void, delay: number) => {
    timers.current.push(window.setTimeout(callback, delay))
  }

  const install = () => {
    if (installing) return
    setInstalling(true)
    onNotify(`Added ${app.name}`)
    schedule(() => {
      store.installApp(app.id)
      setAccounts([{ id: 'default', label: 'default', status: 'pending' }])
      setInstalling(false)
    }, 700)
  }

  const uninstall = () => {
    store.uninstallApp(app.id)
    setAccounts([])
    setAddingAccount(false)
    onNotify(`Removed ${app.name}`)
  }

  const authorize = (accountId = 'default') => {
    setAccounts((items) => items.map((account) => account.id === accountId ? { ...account, status: 'pending' } : account))
    onNotify(`Opened the ${app.name} OAuth flow in your browser. Return here once it completes.`)
    schedule(() => {
      store.connectApp(app.id)
      setAccounts((items) => items.map((account) => account.id === accountId ? { ...account, status: 'connected' } : account))
      onNotify(`${app.name} connected`)
    }, 1400)
  }

  const addAccount = () => {
    const id = `account-${accounts.length + 1}`
    const label = accountLabel.trim() || `Account ${accounts.length + 1}`
    setAccounts((items) => [...items, { id, label, status: 'pending' }])
    setAccountLabel('')
    setAddingAccount(false)
    onNotify(`Opened the ${app.name} OAuth flow in your browser. Return here once it completes.`)
    schedule(() => {
      store.connectApp(app.id)
      setAccounts((items) => items.map((account) => account.id === id ? { ...account, status: 'connected' } : account))
      onNotify(`${label} connected`)
    }, 1400)
  }

  const disconnect = (accountId: string) => {
    const next = accounts.map((account) => account.id === accountId ? { ...account, status: 'pending' as const } : account)
    setAccounts(next)
    if (!next.some((account) => account.status === 'connected')) store.disconnectApp(app.id)
    onNotify(`${app.name} account disconnected`)
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`https://grok.bot/integrations/${app.id}`)
    } catch {
      // Clipboard may be unavailable in a sandboxed preview.
    }
    setCopied(true)
    schedule(() => setCopied(false), 1600)
  }

  const visibleSkills = showAllSkills ? app.skills : app.skills.slice(0, 5)

  return (
    <div className="integration-details">
      <header className="integration-subheader">
        <IconButton label="Back to Connect Apps" onClick={onBack}><ChevronLeft size={20} /></IconButton>
        <h2>{app.name}</h2>
      </header>

      <div className="integration-scroll integration-details__scroll">
        <section className="integration-app-hero">
          <div className="integration-app-hero__top">
            <div className="integration-app-hero__identity">
              <IntegrationIcon icon={app.icon} size={58} />
              <h3>{app.name}{installed && <Link size={14} aria-label="已安装" />}</h3>
            </div>
            <div className="integration-app-hero__actions">
              <Button variant="secondary" onClick={share}>{copied ? <Check size={15} /> : <Link size={15} />}{copied ? 'Copied' : 'Share'}</Button>
              {installed ? (
                <Button variant="secondary" onClick={uninstall}>Uninstall</Button>
              ) : (
                <Button onClick={install} disabled={installing}>{installing ? 'Connecting…' : 'Connect'}</Button>
              )}
            </div>
          </div>
          <p>{app.description}</p>
        </section>

        {installed && accounts.length > 0 && (
          <section className="integration-detail-section">
            <h3>Accounts</h3>
            <div className="integration-panel integration-accounts">
              {accounts.map((account) => (
                <div className="integration-account" key={account.id}>
                  <div className="integration-account__copy">
                    <strong>{account.label}<SquareArrowOutUpRight size={12} /></strong>
                    <span>{account.status === 'connected' ? `${app.name} account authorized.` : `Waiting for ${app.name} authorization…`}</span>
                  </div>
                  <span className={account.status === 'connected' ? 'integration-account-status is-connected' : 'integration-account-status'}>
                    {account.status === 'connected' ? 'Connected' : 'Not connected'}
                  </span>
                  {account.status === 'connected' ? (
                    <Button variant="secondary" size="sm" onClick={() => disconnect(account.id)}>Disconnect</Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => authorize(account.id)}>Reconnect</Button>
                  )}
                </div>
              ))}
              {addingAccount ? (
                <div className="integration-account-form">
                  <input
                    autoFocus
                    value={accountLabel}
                    onChange={(event) => setAccountLabel(event.target.value)}
                    placeholder="Label this account, e.g. work or personal"
                    aria-label="账户标签"
                    onKeyDown={(event) => { if (event.key === 'Enter') addAccount() }}
                  />
                  <Button variant="secondary" size="sm" onClick={addAccount}>Connect</Button>
                  <Button variant="ghost" size="sm" onClick={() => setAddingAccount(false)}>Cancel</Button>
                </div>
              ) : (
                <button type="button" className="integration-add-account" onClick={() => setAddingAccount(true)}>
                  <Plus size={15} />Add Another Account
                </button>
              )}
            </div>
          </section>
        )}

        <section className="integration-detail-section">
          <h3>Apps <span>1</span></h3>
          <div className="integration-panel integration-connector">
            <Plug size={18} />
            <div><strong>{app.connectorName}</strong><span>Connector</span></div>
          </div>
        </section>

        {app.skills.length > 0 && (
          <section className="integration-detail-section">
            <h3>Skills <span>{app.skills.length}</span></h3>
            <div className="integration-panel integration-skills">
              {visibleSkills.map((skill) => (
                <div className="integration-skill-row" key={skill.id}>
                  <Box size={17} />
                  <div><strong>{skill.name}</strong><span>{skill.description}</span></div>
                </div>
              ))}
              {app.skills.length > 5 && (
                <button type="button" className="integration-more-skills" onClick={() => setShowAllSkills((value) => !value)}>
                  {showAllSkills ? 'Show less' : `${app.skills.length - 5} more`}
                </button>
              )}
            </div>
          </section>
        )}

        <section className="integration-detail-section">
          <h3>Information</h3>
          <dl className="integration-panel integration-information">
            <div><dt>Capabilities</dt><dd>1 app{app.skills.length > 0 ? `, ${app.skills.length} skills` : ''}</dd></div>
            <div><dt>Developer</dt><dd>{app.developer}</dd></div>
            <div><dt>Category</dt><dd>{app.category === 'Code' ? 'Infrastructure' : app.category}</dd></div>
            <div><dt>Website</dt><dd>{app.website}</dd></div>
            <div><dt>Availability</dt><dd>{app.team ? 'Team' : 'Public'}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  )
}
