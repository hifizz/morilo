import { useState } from 'react'
import { Check, ChevronRight, FileCode2, FileText, Plus, Sparkles, X } from 'lucide-react'
import type { Agent, Conversation, LibraryFile } from '@/types/chat'
import { AgentAvatar } from './AgentAvatar'
import { ComputerPanel } from './ComputerPanel'
import { Button, IconButton, SegmentedControl, TextField } from '@/design-system'

type InspectorTab = 'details' | 'library' | 'computer'

interface InspectorPanelProps {
  agent: Agent
  conversation: Conversation
  files: LibraryFile[]
  mobile?: boolean
  onClose: () => void
  onNotify: (message: string) => void
}

export function InspectorPanel({ agent, conversation, files, mobile = false, onClose, onNotify }: InspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>('details')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [routineOpen, setRoutineOpen] = useState(false)
  const [routine, setRoutine] = useState('')
  const [routines, setRoutines] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState(files[0]?.id)
  const [label, setLabel] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)

  const activeFile = files.find((file) => file.id === selectedFile) ?? files[0]

  return (
    <aside className={`inspector ${mobile ? 'inspector--mobile' : ''}`} aria-label={`${agent.name} 详情`}>
      {mobile && (
        <div className="inspector__top-actions">
          <IconButton label="关闭详情" onClick={onClose}><X size={18} /></IconButton>
        </div>
      )}
      <div className="agent-profile">
        <AgentAvatar color={agent.color} variant={agent.variant} size={72} />
        <h2>{agent.name}</h2>
        {editingLabel ? (
          <form className="label-form" onSubmit={(event) => { event.preventDefault(); setEditingLabel(false); onNotify('标签已保存') }}>
            <TextField variant="bare" autoFocus value={label} onChange={(event) => setLabel(event.target.value)} placeholder="输入标签" aria-label="Agent 标签" />
            <button type="submit" aria-label="保存标签"><Check size={14} /></button>
          </form>
        ) : <button type="button" className="add-label" onClick={() => setEditingLabel(true)}>{label || 'Add a label'}</button>}
      </div>
      <SegmentedControl
        value={tab}
        onValueChange={setTab}
        label="Agent 信息视图"
        className="inspector-tabs"
        options={[
          { value: 'details', label: 'Details' },
          { value: 'library', label: 'Library' },
          { value: 'computer', label: 'Computer' },
        ]}
      />

      <div className="inspector__content">
        {tab === 'details' && (
          <>
            <section className="inspector-section">
              <h3>Coding</h3>
              <div className="task-list">
                {conversation.tasks.length ? conversation.tasks.map((task) => (
                  <div className={`task-card ${expandedTask === task.id ? 'is-expanded' : ''}`} key={task.id}>
                    <button type="button" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} aria-expanded={expandedTask === task.id}>
                      <span className={`task-status task-status--${task.status}`}>{task.status === 'finished' ? <Check size={15} /> : <Sparkles size={15} />}</span>
                      <span className="task-card__copy"><strong>{task.title}</strong><small>{task.status === 'finished' ? 'Finished' : task.status === 'queued' ? 'Queued' : 'Working…'}</small></span>
                      <ChevronRight size={15} className="task-card__chevron" />
                    </button>
                    {expandedTask === task.id && <p>{task.detail}</p>}
                  </div>
                )) : <div className="inspector-empty">当前会话还没有任务</div>}
              </div>
            </section>
            <section className="inspector-section routines-section">
              <h3>Routines</h3>
              {routines.map((item) => <div className="routine-item" key={item}><span className="routine-dot" />{item}</div>)}
              {routineOpen ? (
                <form className="routine-form" onSubmit={(event) => { event.preventDefault(); if (!routine.trim()) return; setRoutines((items) => [...items, routine.trim()]); setRoutine(''); setRoutineOpen(false); onNotify('Routine 已添加') }}>
                  <TextField variant="bare" autoFocus value={routine} onChange={(event) => setRoutine(event.target.value)} placeholder="例如：每天 9 点检查 CI" aria-label="Routine 内容" />
                  <div><Button variant="ghost" size="sm" onClick={() => setRoutineOpen(false)}>取消</Button><Button size="sm" type="submit" disabled={!routine.trim()}>保存</Button></div>
                </form>
              ) : (
                <button type="button" className="add-routine" onClick={() => setRoutineOpen(true)}><Plus size={16} /><span>Ask in chat to set a routine</span></button>
              )}
            </section>
            <section className="inspector-section about-section">
              <h3>About</h3>
              <p>{agent.description}</p>
              <ul>{agent.capabilities.map((capability) => <li key={capability}>{capability}</li>)}</ul>
            </section>
          </>
        )}

        {tab === 'library' && (
          <section className="inspector-section library-section">
            <h3>Library <span>{files.length}</span></h3>
            <div className="library-list">
              {files.map((file) => (
                <button type="button" key={file.id} className={selectedFile === file.id ? 'is-active' : ''} onClick={() => setSelectedFile(file.id)}>
                  {file.type === 'Code' ? <FileCode2 size={18} /> : <FileText size={18} />}
                  <span><strong>{file.name}</strong><small>{file.type} · {file.updated}</small></span>
                </button>
              ))}
            </div>
            {activeFile && <pre className="file-preview"><code>{activeFile.content}</code></pre>}
          </section>
        )}

        {tab === 'computer' && (
          <section className="inspector-section computer-section">
            <h3>Computer</h3>
            <ComputerPanel label={agent.name} />
          </section>
        )}
      </div>
    </aside>
  )
}
