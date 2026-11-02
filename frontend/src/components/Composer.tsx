import { useEffect, useRef, useState } from 'react'
import { ArrowUp, AudioLines, CornerUpLeft, FileText, Mic, Plus, X } from 'lucide-react'
import { IconButton, TextArea } from '@/design-system'
import type { ChatMessage } from '@/types/chat'

interface ComposerProps {
  agentName: string
  replyTo: ChatMessage | null
  disabled?: boolean
  onCancelReply: () => void
  onSend: (text: string, attachment?: string) => void
  onNotify: (message: string) => void
}

export function Composer({ agentName, replyTo, disabled = false, onCancelReply, onSend, onNotify }: ComposerProps) {
  const [value, setValue] = useState('')
  const [attachment, setAttachment] = useState<string>()
  const [listening, setListening] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!replyTo) return
    textareaRef.current?.focus()
    const end = textareaRef.current?.value.length ?? 0
    textareaRef.current?.setSelectionRange(end, end)
  }, [replyTo])

  const submit = () => {
    const text = value.trim()
    if ((!text && !attachment) || disabled) return
    onSend(text || '请查看这个附件。', attachment)
    setValue('')
    setAttachment(undefined)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  return (
    <div className={`composer ${listening ? 'is-listening' : ''} ${replyTo ? 'has-reply' : ''}`}>
      {replyTo && (
        <div className="composer-reply" role="group" aria-label="待发送的引用消息">
          <CornerUpLeft size={14} aria-hidden="true" />
          <span>回复</span>
          <span className="composer-reply__quote">{replyTo.text.replace(/\s+/g, ' ')}</span>
          <button type="button" aria-label="移除引用" title="移除引用" onClick={onCancelReply}><X size={13} /></button>
        </div>
      )}
      {attachment && (
        <div className="attachment-chip"><FileText size={14} /><span>{attachment}</span><button type="button" onClick={() => setAttachment(undefined)} aria-label="移除附件"><X size={13} /></button></div>
      )}
      {listening && <div className="listening-label"><span />正在聆听，再次点击麦克风结束</div>}
      <div className="composer__row">
        <input ref={fileRef} className="sr-only" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setAttachment(file.name); onNotify(`已添加 ${file.name}`) } event.target.value = '' }} />
        <IconButton label="添加附件" className="composer__plus" onClick={() => fileRef.current?.click()}><Plus size={21} /></IconButton>
        <TextArea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => { setValue(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px` }}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }}
          placeholder={`Message ${agentName}`}
          aria-label={`给 ${agentName} 发送消息`}
        />
        <div className="composer__actions">
          <IconButton label={listening ? '结束语音输入' : '开始语音输入'} active={listening} onClick={() => { setListening((current) => !current); onNotify(listening ? '语音输入已结束' : '语音输入已开启') }}><Mic size={19} /></IconButton>
          {value.trim() || attachment ? (
            <IconButton label="发送消息" className="composer__send" disabled={disabled} onClick={submit}><ArrowUp size={20} /></IconButton>
          ) : (
            <IconButton label="切换语音模式" className="composer__voice" onClick={() => onNotify('语音模式已就绪，点击麦克风开始说话')}><AudioLines size={20} /></IconButton>
          )}
        </div>
      </div>
    </div>
  )
}
