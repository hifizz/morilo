import { useState, type FormEvent } from 'react'
import { Button, Dialog, TextField } from '@/design-system'

interface RenameBotDialogProps {
  initialName: string
  onRename: (name: string) => void
  onClose: () => void
}

export function RenameBotDialog({ initialName, onRename, onClose }: RenameBotDialogProps) {
  const [name, setName] = useState(initialName)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextName = name.trim()
    if (nextName) onRename(nextName)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title="Rename Bot" className="rename-bot-dialog">
      <form onSubmit={submit}>
        <label className="rename-bot-dialog__field">
          Bot name
          <TextField autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={32} onFocus={(event) => event.currentTarget.select()} />
        </label>
        <footer className="dialog-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!name.trim()}>Save</Button>
        </footer>
      </form>
    </Dialog>
  )
}
