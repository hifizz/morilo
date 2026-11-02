import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton, Switch, TextArea } from '@/design-system'
import { SettingCard } from './SettingControls'
import type { SettingsPageProps } from './types'

type RuleGroup = 'ask' | 'allow'
interface Rule { id: number; text: string }

export function PermissionsSettings({ onNotify }: SettingsPageProps) {
  const [autoReview, setAutoReview] = useState(true)
  const [rules, setRules] = useState<Record<RuleGroup, Rule[]>>({ ask: [{ id: 1, text: '$50' }], allow: [] })
  const [editing, setEditing] = useState<{ group: RuleGroup; id?: number } | null>(null)
  const [draft, setDraft] = useState('')

  const openEditor = (group: RuleGroup, rule?: Rule) => {
    setEditing({ group, id: rule?.id })
    setDraft(rule?.text ?? (group === 'ask' ? 'Purchases over $50' : ''))
  }

  const saveRule = () => {
    if (!editing || !draft.trim()) return
    setRules((current) => {
      const groupRules = current[editing.group]
      const next = editing.id
        ? groupRules.map((rule) => rule.id === editing.id ? { ...rule, text: draft.trim() } : rule)
        : [...groupRules, { id: Date.now(), text: draft.trim() }]
      return { ...current, [editing.group]: next }
    })
    onNotify(editing.id ? '权限规则已更新' : '权限规则已添加')
    setEditing(null)
    setDraft('')
  }

  const renderGroup = (group: RuleGroup, title: string, description: string) => (
    <section className="permission-group">
      <div className="permission-group__heading"><div><h3>{title}</h3><p>{description}</p></div><Button variant="ghost" size="sm" onClick={() => openEditor(group)}>Add Rule</Button></div>
      {rules[group].map((rule) => (
        <div className="permission-rule" key={rule.id}>
          <span>{rule.text}</span>
          <IconButton label="编辑规则" onClick={() => openEditor(group, rule)}><Pencil size={14} /></IconButton>
          <IconButton label="删除规则" onClick={() => { setRules((current) => ({ ...current, [group]: current[group].filter((item) => item.id !== rule.id) })); onNotify('权限规则已删除') }}><Trash2 size={14} /></IconButton>
        </div>
      ))}
      {editing?.group === group && (
        <div className="permission-editor">
          <label htmlFor={`rule-${group}`}>Applies to</label>
          <TextArea id={`rule-${group}`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Purchases over $50" autoFocus />
          <p>Name the action and who or what it affects, like “Emails to dana@acme.com”</p>
          <div><Button variant="secondary" size="sm" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" disabled={!draft.trim()} onClick={saveRule}>{editing.id ? 'Save rule' : 'Add rule'}</Button></div>
        </div>
      )}
    </section>
  )

  return (
    <div className="settings-scroll">
      <SettingCard><div className="setting-row"><div className="setting-row__copy"><strong>Auto-Review</strong><p>Review Grok Bot actions based on custom rules</p></div><Switch label="自动审核" checked={autoReview} onCheckedChange={setAutoReview} /></div></SettingCard>
      {renderGroup('ask', 'Always Ask', 'Stop and ask when an action matches these rules')}
      {renderGroup('allow', 'Allow without Asking', 'Continue automatically when an action matches these rules')}
    </div>
  )
}
