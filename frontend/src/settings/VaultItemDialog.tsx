import { useRef, useState, type FormEvent } from 'react'
import { Camera, Eye, Globe2, ImagePlus, Plus, Upload } from 'lucide-react'
import { Button, Dialog, IconButton, Select, TextField } from '@/design-system'

export type VaultEditorKind = 'login' | 'card' | 'contact' | 'import'
export interface VaultItemInput { kind: Exclude<VaultEditorKind, 'import'>; title: string; subtitle: string }

interface VaultItemDialogProps {
  kind: VaultEditorKind
  onClose: () => void
  onSave: (item: VaultItemInput) => void
  onImport: (file: File) => void
  onNotify: (message: string) => void
}

const titles: Record<VaultEditorKind, string> = { login: 'New login', card: 'New card', contact: 'New contact info', import: 'Import from CSV' }

export function VaultItemDialog({ kind, onClose, onSave, onImport, onNotify }: VaultItemDialogProps) {
  const [websiteCount, setWebsiteCount] = useState(1)
  const [showBilling, setShowBilling] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [country, setCountry] = useState('cn')
  const fileRef = useRef<HTMLInputElement>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (kind === 'login') {
      const website = String(data.get('website') || '').trim()
      if (!website) return
      onSave({ kind, title: website, subtitle: String(data.get('username') || 'Saved login') })
    } else if (kind === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 4) return
      onSave({ kind, title: String(data.get('nickname') || `Card •••• ${cardNumber.replace(/\s/g, '').slice(-4)}`), subtitle: `•••• ${cardNumber.replace(/\s/g, '').slice(-4)} · ${String(data.get('expiry') || 'No expiry')}` })
    } else if (kind === 'contact') {
      const name = String(data.get('fullName') || '').trim()
      if (!name) return
      onSave({ kind, title: name, subtitle: String(data.get('email') || data.get('phone') || 'Contact information') })
    }
  }

  if (kind === 'import') {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={titles[kind]} className="vault-item-dialog vault-import-dialog">
        <div className="vault-form">
          <Upload size={23} />
          <p>Import logins from a CSV file exported by 1Password, Chrome, Edge, Safari, Apple Passwords, Firefox, Bitwarden, or LastPass.</p>
          <p>Cards come along from LastPass exports.<br />The file is read on this device and never uploaded.</p>
          <footer className="dialog-footer"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => fileRef.current?.click()}>Choose CSV file</Button></footer>
          <input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file) }} />
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={titles[kind]} className={`vault-item-dialog vault-item-dialog--${kind}`}>
      <form className="vault-form" onSubmit={submit}>
        {kind === 'login' && (
          <>
            {Array.from({ length: websiteCount }, (_, index) => <label className="field-label" key={index}>Website<div className="input-with-icon"><Globe2 size={15} /><TextField name={index === 0 ? 'website' : `website${index}`} placeholder="example.com" required={index === 0} autoFocus={index === 0} /></div></label>)}
            <Button variant="ghost" size="sm" className="align-start" onClick={() => setWebsiteCount((count) => count + 1)}><Plus size={14} />Add website</Button>
            <label className="field-label">Username or email (Optional)<TextField name="username" placeholder="name@example.com" /></label>
            <label className="field-label">Password<TextField name="password" type="password" autoComplete="current-password" /></label>
            <label className="field-label">Hints (Optional)<TextField name="hints" /></label>
            <p className="field-help">Tell Bot when to use this entry</p>
            <p className="field-help">Grok Bot can use this login to sign in for you</p>
          </>
        )}
        {kind === 'card' && (
          <>
            <div className="vault-scan-actions"><Button variant="secondary" onClick={() => onNotify('相机扫描为演示入口')}><Camera size={16} />Scan with camera</Button><Button variant="secondary" onClick={() => onNotify('照片上传为演示入口')}><ImagePlus size={16} />Upload a photo</Button></div>
            <div className="form-divider"><span>or type it in</span></div>
            <label className="field-label">Card number<TextField value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} inputMode="numeric" autoFocus placeholder="1234 5678 9012 3456" /></label>
            <div className="field-grid">
              <label className="field-label">Expiry<TextField name="expiry" placeholder="MM / YY" /></label>
              <label className="field-label">Security code (Optional)<div className="input-with-action"><TextField name="code" type={showCode ? 'text' : 'password'} autoComplete="cc-csc" inputMode="numeric" /><IconButton label={showCode ? '隐藏安全码' : '显示安全码'} onClick={() => setShowCode((value) => !value)}><Eye size={15} /></IconButton></div></label>
              <label className="field-label">Name on card (Optional)<TextField name="cardName" /></label>
              <label className="field-label">Nickname (Optional)<TextField name="nickname" placeholder="e.g. Travel" /></label>
            </div>
            <Button variant="secondary" onClick={() => setShowBilling((value) => !value)}><Plus size={15} />Add a billing address (Optional)</Button>
            {showBilling && <label className="field-label">Billing address<TextField name="billing" placeholder="Street, city, postal code" /></label>}
            <label className="field-label">Hints (Optional)<TextField name="hints" /></label>
            <p className="field-help">Tell Bot when to use this entry</p>
          </>
        )}
        {kind === 'contact' && (
          <>
            <label className="field-label">Full name<TextField name="fullName" required autoFocus /></label>
            <label className="field-label">Address<TextField name="address" /></label>
            <label className="field-label">Address line 2<TextField name="address2" /></label>
            <div className="field-grid">
              <label className="field-label">City<TextField name="city" /></label>
              <label className="field-label">State or region<TextField name="region" /></label>
              <label className="field-label">ZIP or postal code<TextField name="postal" /></label>
              <label className="field-label">Country<Select label="国家或地区" value={country} onValueChange={setCountry} options={[{ value: 'cn', label: 'China' }, { value: 'sg', label: 'Singapore' }, { value: 'us', label: 'United States' }]} /></label>
            </div>
            <label className="field-label">Phone<TextField name="phone" type="tel" /></label><span className="field-help">Add phone</span>
            <label className="field-label">Email address<TextField name="email" type="email" /></label><span className="field-help">Add email</span>
            <div className="field-grid"><label className="field-label">Label<TextField name="label" /></label><label className="field-label">Hints<TextField name="hints" /></label></div>
            <p className="field-help">Tell Bot when to use this entry</p>
          </>
        )}
        <footer className="dialog-footer vault-form__footer">
          <span>{kind === 'card' ? 'Grok Bot never sees the number' : ''}</span>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={kind === 'card' && cardNumber.replace(/\s/g, '').length < 4}>{kind === 'login' ? 'Save login' : kind === 'card' ? 'Save card' : 'Save contact info'}</Button>
        </footer>
      </form>
    </Dialog>
  )
}
