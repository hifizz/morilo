import { useState } from 'react'
import { AgentAvatar } from './AgentAvatar'
import { Button, Dialog } from '@/design-system'
import type { AgentColor } from '@/types/chat'

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
  const [name, setName] = useState('')
  const [color, setColor] = useState<AgentColor>('orange')
  const [variant, setVariant] = useState(4)

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title="Create New Bot" className="new-bot-dialog">
      <div className="new-bot-preview">
        <AgentAvatar color={color} variant={variant} size={88} />
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name your Bot"
          aria-label="Bot 名称"
          maxLength={32}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && name.trim()) onCreate({ name: name.trim(), color, variant })
          }}
        />
      </div>
      <div className="bot-shape-grid" aria-label="选择 Bot 外形">
        {Array.from({ length: 16 }, (_, index) => (
          <button
            type="button"
            key={index}
            className={variant === index ? 'is-selected' : ''}
            aria-label={`外形 ${index + 1}`}
            aria-pressed={variant === index}
            onClick={() => setVariant(index)}
          >
            <AgentAvatar color={color} variant={index} size={34} />
          </button>
        ))}
      </div>
      <div className="bot-color-grid" aria-label="选择 Bot 颜色">
        {colors.map((item) => (
          <button
            type="button"
            key={item}
            className={`bot-color bot-color--${item} ${color === item ? 'is-selected' : ''}`}
            aria-label={`颜色 ${item}`}
            aria-pressed={color === item}
            onClick={() => setColor(item)}
          />
        ))}
      </div>
      <footer className="dialog-footer">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), color, variant })}>Create</Button>
      </footer>
    </Dialog>
  )
}
