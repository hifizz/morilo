import { useState } from 'react'
import { ChevronLeft, FileText } from 'lucide-react'
import { Button, IconButton } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import type { PrivateSkill } from './types'

interface SkillEditorProps {
  skill: PrivateSkill
  onBack: () => void
  onSave: (skill: PrivateSkill) => void
  onDelete: (id: string) => void
  onNotify: (message: string) => void
}

export function SkillEditor({ skill, onBack, onSave, onDelete, onNotify }: SkillEditorProps) {
  const { snapshot, t } = useSettings()
  const [name, setName] = useState(skill.name)
  const [description, setDescription] = useState(skill.description)
  const [instructions, setInstructions] = useState(skill.instructions)
  const dirty = name !== skill.name || description !== skill.description || instructions !== skill.instructions

  const save = () => {
    if (!dirty || !name.trim()) return
    onSave({ ...skill, name: name.trim(), description: description.trim(), instructions })
    onNotify(t('本地技能已保存。', 'Local skill saved.'))
  }

  return (
    <div className="integration-skill-editor">
      <header className="integration-subheader">
        <IconButton label={t('返回管理连接与本地技能', 'Back to connections and local skills')} onClick={onBack}><ChevronLeft size={20} /></IconButton>
        <h2>{skill.name}</h2>
      </header>
      <div className="integration-scroll integration-skill-editor__scroll">
        <section className="integration-skill-hero">
          <div className="integration-skill-hero__top">
            <div className="integration-skill-hero__identity">
              <span className="integration-skill-file"><FileText size={25} /></span>
              <div><h3>{skill.name}</h3><span>{t('本地技能（演示，不会安装到 Pi）', 'Local skill (demo, not installed into Pi)')}</span></div>
            </div>
            <div className="integration-skill-hero__actions">
              <Button variant="secondary" disabled>{t('发布（尚未接入）', 'Publish (coming soon)')}</Button>
              <Button variant="ghost" className="integration-delete-skill" onClick={() => { onDelete(skill.id); onNotify(t('本地技能已删除。', 'Local skill deleted.')) }}>{t('删除技能', 'Delete skill')}</Button>
            </div>
          </div>
          <p>{skill.description}</p>
        </section>

        <div className="integration-skill-form">
          <label>
            <span>{t('名称', 'Name')}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} spellCheck={snapshot?.preferences.spellcheck ?? true} />
          </label>
          <label>
            <span>{t('描述', 'Description')}</span>
            <textarea className="integration-skill-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} spellCheck={snapshot?.preferences.spellcheck ?? true} />
          </label>
          <label>
            <span>{t('指令', 'Instructions')}</span>
            <textarea className="integration-skill-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} spellCheck={false} />
          </label>
        </div>
      </div>
      <div className="integration-skill-savebar">
        <Button disabled={!dirty || !name.trim()} onClick={save}>{t('保存', 'Save')}</Button>
      </div>
    </div>
  )
}
