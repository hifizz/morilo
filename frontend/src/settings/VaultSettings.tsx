import { useMemo, useState } from 'react'
import { CircleHelp, CreditCard, FileUp, KeyRound, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { Button, IconButton, Menu, TextField } from '@/design-system'
import { SettingSectionLabel } from './SettingControls'
import { VaultItemDialog, type VaultEditorKind, type VaultItemInput } from './VaultItemDialog'
import type { SettingsPageProps } from './types'
import { useSettings } from './SettingsProvider'

type VaultFilter = 'all' | 'login' | 'card' | 'contact'
interface VaultItem extends VaultItemInput { id: number }

export function VaultSettings({ onNotify }: SettingsPageProps) {
  const { t, snapshot } = useSettings()
  const [filter, setFilter] = useState<VaultFilter>('all')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<VaultEditorKind | null>(null)
  const [items, setItems] = useState<VaultItem[]>([])
  const [connected, setConnected] = useState<string[]>([])
  const counts = useMemo(() => ({ all: items.length, login: items.filter((item) => item.kind === 'login').length, card: items.filter((item) => item.kind === 'card').length, contact: items.filter((item) => item.kind === 'contact').length }), [items])
  const visible = items.filter((item) => (filter === 'all' || item.kind === filter) && `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase()))
  const labels: Record<VaultFilter, string> = { all: t('全部', 'All'), login: t('登录信息', 'Logins'), card: t('支付信息', 'Payments'), contact: t('联系信息', 'Contact info') }
  const emptyText = filter === 'all'
    ? t('暂无保存内容。点击“新建条目”添加登录、卡片或联系信息。', 'Nothing saved yet. Add a login, card, or contact info with New item.')
    : filter === 'login'
      ? t('暂无登录信息。点击“新建条目”添加，或从安全表单保存。', 'No logins yet. Add one with New item, or save one from a secure form.')
      : filter === 'contact'
        ? t('暂无联系信息。点击“新建条目”添加，或在结账时保存。', 'No contact info yet. Add some with New item, or save it at checkout.')
        : t('暂无支付方式。点击“新建条目”添加卡片。', 'No payment methods yet. Add a card with New item.')

  const saveItem = (input: VaultItemInput) => {
    setItems((current) => [...current, { ...input, id: Date.now() }])
    setEditor(null)
    onNotify(t('保险库条目已保存到当前演示会话', 'Vault entry saved in this demo session'))
  }

  const importCsv = async (file: File) => {
    const text = await file.text()
    const rows = text.split(/\r?\n/).filter((line) => line.trim()).slice(1, 6)
    const imported = rows.map((row, index) => {
      const cells = row.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''))
      return { id: Date.now() + index, kind: 'login' as const, title: cells[0] || t(`导入的登录项 ${index + 1}`, `Imported login ${index + 1}`), subtitle: cells[1] || t('从 CSV 导入', 'Imported from CSV') }
    })
    setItems((current) => [...current, ...imported])
    setEditor(null)
    onNotify(t(`已从 ${file.name} 导入 ${imported.length} 条演示数据`, `Imported ${imported.length} demo entries from ${file.name}`))
  }

  return (
    <>
      <div className="vault-new-item">
        <Menu label={t('新建保险库条目', 'New Vault entry')} align="end" trigger={<Button size="sm"><Plus size={14} />{t('新建条目', 'New item')}</Button>} items={[
          { id: 'login', label: t('登录信息', 'Login'), icon: <KeyRound size={15} />, onSelect: () => setEditor('login') },
          { id: 'card', label: t('卡片', 'Card'), icon: <CreditCard size={15} />, onSelect: () => setEditor('card') },
          { id: 'contact', label: t('联系信息', 'Contact info'), icon: <UserRound size={15} />, onSelect: () => setEditor('contact') },
          { id: 'import', label: t('导入', 'Import'), icon: <FileUp size={15} />, onSelect: () => setEditor('import') },
        ]} />
      </div>
      <IconButton label={t('保险库帮助', 'Vault help')} className="vault-help" onClick={() => onNotify(t('保险库仅保存在当前前端演示会话中', 'Vault is stored only in the current frontend demo session'))}><CircleHelp size={14} /></IconButton>
      <div className="settings-scroll vault-settings">
      <div className="vault-toolbar">
        <div className="vault-tabs" role="tablist" aria-label={t('保险库类型', 'Vault categories')}>
          {(Object.keys(labels) as VaultFilter[]).map((key) => <button type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} key={key} onClick={() => setFilter(key)}>{labels[key]} <span>{counts[key]}</span></button>)}
        </div>
        <label className="vault-search"><Search size={14} /><TextField variant="bare" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('搜索保险库', 'Search Vault')} aria-label={t('搜索保险库', 'Search Vault')} spellCheck={snapshot?.preferences.spellcheck ?? true} /></label>
      </div>
      {filter === 'card' && (
        <SettingSectionLabel>{t('支付账户', 'Payment accounts')}</SettingSectionLabel>
      )}
      {filter === 'card' && (
        <div className="payment-accounts">
          {['X Money', 'Link', 'Shop Pay'].map((name) => <div key={name}><CreditCard size={17} /><span><strong>{name}</strong><small>{t(`使用你的 ${name} 账户付款`, `Pay with your ${name} account`)}</small></span><Button variant="ghost" size="sm" onClick={() => { setConnected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]); onNotify(connected.includes(name) ? t(`${name} 已断开（演示）`, `${name} disconnected (demo)`) : t(`${name} 已连接（演示）`, `${name} connected (demo)`)) }}>{connected.includes(name) ? t('已连接', 'Connected') : t('连接', 'Connect')}</Button></div>)}
        </div>
      )}
      <div className="vault-items">
        {visible.map((item) => <div className="vault-item" key={item.id}>{item.kind === 'login' ? <KeyRound size={18} /> : item.kind === 'card' ? <CreditCard size={18} /> : <UserRound size={18} />}<span><strong>{item.title}</strong><small>{item.subtitle}</small></span><IconButton label={t(`删除 ${item.title}`, `Delete ${item.title}`)} onClick={() => { setItems((current) => current.filter((entry) => entry.id !== item.id)); onNotify(t('保险库条目已删除', 'Vault entry deleted')) }}><Trash2 size={15} /></IconButton></div>)}
        {visible.length === 0 && <div className="vault-empty"><p>{query ? t('没有匹配的保险库条目。', 'No matching Vault entries.') : emptyText}</p></div>}
      </div>
      <p className="vault-privacy">{t('Grok Bot 不会看到已保存卡片的号码或安全码。它可以看到登录和联系信息，以便代你填写。', "Grok Bot never sees a saved card's number or security code. It can see logins and contact info so it can type them in for you.")}</p>
      </div>
      {editor && <VaultItemDialog kind={editor} onClose={() => setEditor(null)} onSave={saveItem} onImport={importCsv} onNotify={onNotify} />}
    </>
  )
}
