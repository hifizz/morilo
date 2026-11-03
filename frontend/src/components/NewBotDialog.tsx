import { useState } from 'react'
import { AgentAvatar } from './AgentAvatar'
import { Button, Dialog } from '@/design-system'
import type { AgentColor } from '@/types/chat'
import { useSettings } from '@/settings/SettingsProvider'

export interface NewBotInput {
  name: string
  color: AgentColor
  variant: number
}

interface NewBotDialogProps {
  onCreate: (input: NewBotInput) => void
  onClose: () => void
}

const colors: AgentColor[] = ['white', 'teal', 'blue', 'purple', 'red', 'gray', 'orange', 'yellow', 'green']

export function NewBotDialog({ onCreate, onClose }: NewBotDialogProps) {
  const { t, snapshot } = useSettings()
  const colorLabels: Record<AgentColor, string> = {
    white: t('白色', 'White'), teal: t('青色', 'Teal'), blue: t('蓝色', 'Blue'),
    purple: t('紫色', 'Purple'), red: t('红色', 'Red'), gray: t('灰色', 'Gray'),
    orange: t('橙色', 'Orange'), yellow: t('黄色', 'Yellow'), green: t('绿色', 'Green'),
  }
  const [name, setName] = useState('')
  const [color, setColor] = useState<AgentColor>('orange')
  const [variant, setVariant] = useState(4)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={t('创建新 Bot', 'Create New Bot')} closeLabel={t('关闭', 'Close')} className="new-bot-dialog">
      <div className="new-bot-preview">
        <AgentAvatar color={color} variant={variant} size={88} />
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('为 Bot 命名', 'Name your Bot')}
          aria-label={t('Bot 名称', 'Bot name')}
          spellCheck={snapshot?.preferences.spellcheck ?? true}
          maxLength={32}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) onCreate({ name: name.trim(), color, variant })
          }}
        />
      </div>
      <div className="bot-shape-grid" aria-label={t('选择 Bot 外形', 'Choose a bot shape')}>
        {Array.from({ length: 16 }, (_, index) => (
          <button
            type="button"
            key={index}
            className={variant === index ? 'is-selected' : ''}
            aria-label={t(`外形 ${index + 1}`, `Shape ${index + 1}`)}
            aria-pressed={variant === index}
            onClick={() => setVariant(index)}
          >
            <AgentAvatar color={color} variant={index} size={34} />
          </button>
        ))}
      </div>
      <div className="bot-color-grid" aria-label={t('选择 Bot 颜色', 'Choose a bot color')}>
        {colors.map((item) => (
          <button
            type="button"
            key={item}
            className={`bot-color bot-color--${item} ${color === item ? 'is-selected' : ''}`}
            aria-label={t(`颜色：${colorLabels[item]}`, `Color: ${colorLabels[item]}`)}
            aria-pressed={color === item}
            onClick={() => setColor(item)}
          />
        ))}
      </div>
      <footer className="dialog-footer">
        <Button variant="secondary" onClick={onClose}>{t('取消', 'Cancel')}</Button>
        <Button disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), color, variant })}>{t('创建', 'Create')}</Button>
      </footer>
    </Dialog>
  )
}
