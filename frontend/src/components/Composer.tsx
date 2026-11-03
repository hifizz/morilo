import { useEffect, useRef, useState } from 'react'
import { ArrowUp, AudioLines, CornerUpLeft, FileText, Mic, Plus, X } from 'lucide-react'
import { IconButton, TextArea } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
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
  const { snapshot, t } = useSettings()
  const [value, setValue] = useState('')
  const [attachment, setAttachment] = useState<string>()
  const spellcheck = snapshot?.preferences.spellcheck ?? true
  const micDisabled = snapshot?.preferences.microphoneId === 'disabled'
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
    <div className={`composer ${replyTo ? 'has-reply' : ''}`}>
      {replyTo && (
        <div className="composer-reply" role="group" aria-label={t('待发送的引用消息', 'Quoted message to send')}>
          <CornerUpLeft size={14} aria-hidden="true" />
          <span>{t('回复', 'Reply')}</span>
          <span className="composer-reply__quote">{replyTo.text.replace(/\s+/g, ' ')}</span>
          <button type="button" aria-label={t('移除引用', 'Remove quote')} title={t('移除引用', 'Remove quote')} onClick={onCancelReply}><X size={13} /></button>
        </div>
      )}
      {attachment && (
        <div className="attachment-chip"><FileText size={14} /><span>{attachment}</span><button type="button" onClick={() => setAttachment(undefined)} aria-label={t('移除附件', 'Remove attachment')}><X size={13} /></button></div>
      )}

      <div className="composer__row">
        <input ref={fileRef} className="sr-only" type="file" aria-label={t('选择附件', 'Choose attachment')} onChange={(event) => { const file = event.target.files?.[0]; if (file) { setAttachment(file.name); onNotify(t(`已添加 ${file.name}`, `Added ${file.name}`)) } event.target.value = '' }} />
        <IconButton label={t('添加附件', 'Add attachment')} className="composer__plus" onClick={() => fileRef.current?.click()}><Plus size={21} /></IconButton>
        <TextArea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(event) => { setValue(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px` }}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }}
          placeholder={t(`给 ${agentName} 发消息`, `Message ${agentName}`)}
          spellCheck={spellcheck}
          aria-label={t(`给 ${agentName} 发送消息`, `Send a message to ${agentName}`)}
        />
        <div className="composer__actions">
          <IconButton label={t('开始语音输入', 'Voice input')} disabled={micDisabled} onClick={() => onNotify(t('语音转写暂未接入，可在设置中测试麦克风', 'Voice transcription is not connected yet — test your microphone in Settings'))}><Mic size={19} /></IconButton>
          {value.trim() || attachment ? (
            <IconButton label={t('发送消息', 'Send message')} className="composer__send" disabled={disabled} onClick={submit}><ArrowUp size={20} /></IconButton>
          ) : (
            <IconButton label={t('切换语音模式', 'Switch to voice mode')} className="composer__voice" disabled={micDisabled} onClick={() => onNotify(t('语音转写暂未接入，可在设置中测试麦克风', 'Voice transcription is not connected yet — test your microphone in Settings'))}><AudioLines size={20} /></IconButton>
          )}
        </div>
      </div>
    </div>
  )
}
