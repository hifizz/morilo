import { useMemo, useState } from 'react'
import { CircleHelp, CreditCard, FileUp, KeyRound, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { Button, IconButton, Menu, TextField } from '@/design-system'
import { SettingSectionLabel } from './SettingControls'
import { VaultItemDialog, type VaultEditorKind, type VaultItemInput } from './VaultItemDialog'
import type { SettingsPageProps } from './types'

type VaultFilter = 'all' | 'login' | 'card' | 'contact'
interface VaultItem extends VaultItemInput { id: number }

export function VaultSettings({ onNotify }: SettingsPageProps) {
  const [filter, setFilter] = useState<VaultFilter>('all')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<VaultEditorKind | null>(null)
  const [items, setItems] = useState<VaultItem[]>([])
  const [connected, setConnected] = useState<string[]>([])
  const counts = useMemo(() => ({ all: items.length, login: items.filter((item) => item.kind === 'login').length, card: items.filter((item) => item.kind === 'card').length, contact: items.filter((item) => item.kind === 'contact').length }), [items])
  const visible = items.filter((item) => (filter === 'all' || item.kind === filter) && `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase()))
  const labels: Record<VaultFilter, string> = { all: 'All', login: 'Logins', card: 'Payments', contact: 'Contact info' }
  const emptyText = filter === 'all' ? 'Nothing saved yet. Add a login, card, or contact info with New item.' : filter === 'login' ? 'No logins yet. Add one with New item, or save one from a secure form.' : filter === 'contact' ? 'No contact info yet. Add some with New item, or save it at checkout.' : 'No payment methods yet. Add a card with New item.'

  const saveItem = (input: VaultItemInput) => {
    setItems((current) => [...current, { ...input, id: Date.now() }])
    setEditor(null)
    onNotify('Vault 条目已保存到当前演示会话')
  }

  const importCsv = async (file: File) => {
    const text = await file.text()
    const rows = text.split(/\r?\n/).filter((line) => line.trim()).slice(1, 6)
    const imported = rows.map((row, index) => {
      const cells = row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
      return { id: Date.now() + index, kind: 'login' as const, title: cells[0] || `Imported login ${index + 1}`, subtitle: cells[1] || 'Imported from CSV' }
    })
    setItems((current) => [...current, ...imported])
    setEditor(null)
    onNotify(`已从 ${file.name} 导入 ${imported.length} 条演示数据`)
  }

  return (
    <>
      <div className="vault-new-item">
        <Menu label="新建 Vault 条目" align="end" trigger={<Button size="sm"><Plus size={14} />New item</Button>} items={[
          { id: 'login', label: 'Login', icon: <KeyRound size={15} />, onSelect: () => setEditor('login') },
          { id: 'card', label: 'Card', icon: <CreditCard size={15} />, onSelect: () => setEditor('card') },
          { id: 'contact', label: 'Contact info', icon: <UserRound size={15} />, onSelect: () => setEditor('contact') },
          { id: 'import', label: 'Import', icon: <FileUp size={15} />, onSelect: () => setEditor('import') },
        ]} />
      </div>
      <IconButton label="Vault 帮助" className="vault-help" onClick={() => onNotify('Vault 仅保存在当前前端演示会话中')}><CircleHelp size={14} /></IconButton>
      <div className="settings-scroll vault-settings">
      <div className="vault-toolbar">
        <div className="vault-tabs" role="tablist" aria-label="Vault 类型">
          {(Object.keys(labels) as VaultFilter[]).map((key) => <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} key={key} onClick={() => setFilter(key)}>{labels[key]} <span>{counts[key]}</span></button>)}
        </div>
        <label className="vault-search"><Search size={14} /><TextField variant="bare" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Vault" aria-label="Search Vault" /></label>
      </div>
      {filter === 'card' && (
        <SettingSectionLabel>Payment accounts</SettingSectionLabel>
      )}
      {filter === 'card' && (
        <div className="payment-accounts">
          {[['X Money', 'Pay with your X Money account'], ['Link', 'Pay with your Link account'], ['Shop Pay', 'Pay with your Shop Pay account']].map(([name, description]) => <div key={name}><CreditCard size={17} /><span><strong>{name}</strong><small>{description}</small></span><Button variant="ghost" size="sm" onClick={() => { setConnected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]); onNotify(`${name} ${connected.includes(name) ? '已断开' : '已连接'}（演示）`) }}>{connected.includes(name) ? 'Connected' : 'Connect'}</Button></div>)}
        </div>
      )}
      <div className="vault-items">
        {visible.map((item) => <div className="vault-item" key={item.id}>{item.kind === 'login' ? <KeyRound size={18} /> : item.kind === 'card' ? <CreditCard size={18} /> : <UserRound size={18} />}<span><strong>{item.title}</strong><small>{item.subtitle}</small></span><IconButton label={`删除 ${item.title}`} onClick={() => { setItems((current) => current.filter((entry) => entry.id !== item.id)); onNotify('Vault 条目已删除') }}><Trash2 size={15} /></IconButton></div>)}
        {visible.length === 0 && <div className="vault-empty"><p>{query ? 'No matching Vault entries.' : emptyText}</p></div>}
      </div>
      <p className="vault-privacy">Grok Bot never sees a saved card's number or security code. It can see logins and contact info so it can type them in for you.</p>
      </div>
      {editor && <VaultItemDialog kind={editor} onClose={() => setEditor(null)} onSave={saveItem} onImport={importCsv} onNotify={onNotify} />}
    </>
  )
}
