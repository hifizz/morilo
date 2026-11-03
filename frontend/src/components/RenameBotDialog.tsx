import { useState, type FormEvent } from 'react'
import { Button, Dialog, TextField } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'

interface RenameBotDialogProps {
  initialName: string
  onRename: (name: string) => void
  onClose: () => void
}

export function RenameBotDialog({ initialName, onRename, onClose }: RenameBotDialogProps) {
  const { t, snapshot } = useSettings()
  const [name, setName] = useState(initialName)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = name.trim()
    if (nextName) onRename(nextName)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={t('重命名 Bot', 'Rename Bot')} closeLabel={t('关闭', 'Close')} className="rename-bot-dialog">
      <form onSubmit={submit}>
        <label className="rename-bot-dialog__field">
          {t('Bot 名称', 'Bot name')}
          <TextField autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={32} onFocus={(event) => event.currentTarget.select()} spellCheck={snapshot?.preferences.spellcheck ?? true} />
        </label>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose}>{t('取消', 'Cancel')}</Button>
          <Button type="submit" disabled={!name.trim()}>{t('保存', 'Save')}</Button>
        </footer>
      </form>
    </Dialog>
  )
}
