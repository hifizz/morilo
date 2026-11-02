import { useState } from 'react'
import { ChevronDown, ChevronLeft, FileText, Link } from 'lucide-react'
import { Button, IconButton, Menu } from '@/design-system'
import type { PrivateSkill } from './types'

interface SkillEditorProps {
  skill: PrivateSkill
  onBack: () => void
  onSave: (skill: PrivateSkill) => void
  onDelete: (id: string) => void
  onNotify: (message: string) => void
}

export function SkillEditor({ skill, onBack, onSave, onDelete, onNotify }: SkillEditorProps) {
  const [name, setName] = useState(skill.name)
  const [description, setDescription] = useState(skill.description)
  const [instructions, setInstructions] = useState(skill.instructions)
  const dirty = name !== skill.name || description !== skill.description || instructions !== skill.instructions

  const save = () => {
    if (!dirty || !name.trim()) return
    onSave({ ...skill, name: name.trim(), description: description.trim(), instructions })
    onNotify('Private skill saved')
  }

  return (
    <div className="integration-skill-editor">
      <header className="integration-subheader">
        <IconButton label="Back to Manage plugins and skills" onClick={onBack}><ChevronLeft size={20} /></IconButton>
        <h2>{skill.name}</h2>
      </header>
      <div className="integration-scroll integration-skill-editor__scroll">
        <section className="integration-skill-hero">
          <div className="integration-skill-hero__top">
            <div className="integration-skill-hero__identity">
              <span className="integration-skill-file"><FileText size={25} /></span>
              <div><h3>{skill.name}</h3><span>Private skill</span></div>
            </div>
            <div className="integration-skill-hero__actions">
              <Menu
                label="发布私人 Skill"
                trigger={<Button variant="secondary"><Link size={14} />Publish<ChevronDown size={13} /></Button>}
                items={[{ id: 'team', label: 'Publish to Cursor team', onSelect: () => onNotify('Publishing a skill needs a Cursor team. Join or create a team first.') }]}
              />
              <Button variant="ghost" className="integration-delete-skill" onClick={() => { onDelete(skill.id); onNotify('Private skill deleted') }}>Delete Skill</Button>
            </div>
          </div>
          <p>{skill.description}</p>
        </section>

        <div className="integration-skill-form">
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>Description</span>
            <textarea className="integration-skill-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
          </label>
          <label>
            <span>Instructions</span>
            <textarea className="integration-skill-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} spellCheck={false} />
          </label>
        </div>
      </div>
      <div className="integration-skill-savebar">
        <Button disabled={!dirty || !name.trim()} onClick={save}>Save</Button>
      </div>
    </div>
  )
}
