import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button, IconButton, Switch, TextArea } from '@/design-system'
import { SettingCard } from './SettingControls'
import type { SettingsPageProps } from './types'
import { useSettings } from './SettingsProvider'

type RuleGroup = 'ask' | 'allow'
interface Rule { id: number; text: string }

export function PermissionsSettings({ onNotify }: SettingsPageProps) {
  const { t, snapshot } = useSettings()
  const [autoReview, setAutoReview] = useState(true)
  const [rules, setRules] = useState<Record<RuleGroup, Rule[]>>({ ask: [{ id: 1, text: '$50' }], allow: [] })
  const [editing, setEditing] = useState<{ group: RuleGroup; id?: number } | null>(null)
  const [draft, setDraft] = useState('')

  const openEditor = (group: RuleGroup, rule?: Rule) => {
    setEditing({ group, id: rule?.id })
    setDraft(rule?.text ?? (group === 'ask' ? t('超过 $50 的购买', 'Purchases over $50') : ''))
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
    onNotify(editing.id ? t('权限规则已更新', 'Permission rule updated') : t('权限规则已添加', 'Permission rule added'))
    setEditing(null)
    setDraft('')
  }

  const renderGroup = (group: RuleGroup, title: string, description: string) => (
    <section className="permission-group">
      <div className="permission-group__heading"><div><h3>{title}</h3><p>{description}</p></div><Button variant="ghost" size="sm" onClick={() => openEditor(group)}>{t('添加规则', 'Add Rule')}</Button></div>
      {rules[group].map((rule) => (
        <div className="permission-rule" key={rule.id}>
          <span>{rule.text}</span>
          <IconButton label={t('编辑规则', 'Edit rule')} onClick={() => openEditor(group, rule)}><Pencil size={14} /></IconButton>
          <IconButton label={t('删除规则', 'Delete rule')} onClick={() => { setRules((current) => ({ ...current, [group]: current[group].filter((item) => item.id !== rule.id) })); onNotify(t('权限规则已删除', 'Permission rule deleted')) }}><Trash2 size={14} /></IconButton>
        </div>
      ))}
      {editing?.group === group && (
        <div className="permission-editor">
          <label htmlFor={`rule-${group}`}>{t('适用于', 'Applies to')}</label>
          <TextArea id={`rule-${group}`} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('超过 $50 的购买', 'Purchases over $50')} autoFocus spellCheck={snapshot?.preferences.spellcheck ?? true} />
          <p>{t('说明操作及其影响对象，例如“发送给 dana@acme.com 的邮件”', 'Name the action and who or what it affects, like “Emails to dana@acme.com”')}</p>
          <div><Button variant="secondary" size="sm" onClick={() => setEditing(null)}>{t('取消', 'Cancel')}</Button><Button size="sm" disabled={!draft.trim()} onClick={saveRule}>{editing.id ? t('保存规则', 'Save rule') : t('添加规则', 'Add rule')}</Button></div>
        </div>
      )}
    </section>
  )

  return (
    <div className="settings-scroll">
      <SettingCard><div className="setting-row"><div className="setting-row__copy"><strong>{t('自动审核', 'Auto-Review')}</strong><p>{t('根据自定义规则审核 Morilo 的操作', 'Review Morilo actions based on custom rules')}</p></div><Switch label={t('自动审核', 'Auto-review')} checked={autoReview} onCheckedChange={setAutoReview} /></div></SettingCard>
      {renderGroup('ask', t('始终询问', 'Always Ask'), t('操作符合这些规则时暂停并询问', 'Stop and ask when an action matches these rules'))}
      {renderGroup('allow', t('无需询问即可允许', 'Allow without Asking'), t('操作符合这些规则时自动继续', 'Continue automatically when an action matches these rules'))}
    </div>
  )
}
