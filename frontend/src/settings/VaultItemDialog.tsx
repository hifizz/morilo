import { useRef, useState, type FormEvent } from 'react'
import { Camera, Eye, Globe2, ImagePlus, Plus, Upload } from 'lucide-react'
import { Button, Dialog, IconButton, Select, TextField } from '@/design-system'
import { useSettings } from './SettingsProvider'

export type VaultEditorKind = 'login' | 'card' | 'contact' | 'import'
export interface VaultItemInput { kind: Exclude<VaultEditorKind, 'import'>; title: string; subtitle: string }

interface VaultItemDialogProps {
  kind: VaultEditorKind
  onClose: () => void
  onSave: (item: VaultItemInput) => void
  onImport: (file: File) => void
  onNotify: (message: string) => void
}

const titles: Record<VaultEditorKind, [string, string]> = { login: ['新建登录信息', 'New login'], card: ['新建卡片', 'New card'], contact: ['新建联系信息', 'New contact info'], import: ['从 CSV 导入', 'Import from CSV'] }

export function VaultItemDialog({ kind, onClose, onSave, onImport, onNotify }: VaultItemDialogProps) {
  const { t, snapshot } = useSettings()
  const spellcheck = snapshot?.preferences.spellcheck ?? true
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
      onSave({ kind, title: website, subtitle: String(data.get('username') || t('已保存的登录信息', 'Saved login')) })
    } else if (kind === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 4) return
      onSave({ kind, title: String(data.get('nickname') || t(`卡片 •••• ${cardNumber.replace(/\s/g, '').slice(-4)}`, `Card •••• ${cardNumber.replace(/\s/g, '').slice(-4)}`)), subtitle: `•••• ${cardNumber.replace(/\s/g, '').slice(-4)} · ${String(data.get('expiry') || t('无有效期', 'No expiry'))}` })
    } else if (kind === 'contact') {
      const name = String(data.get('fullName') || '').trim()
      if (!name) return
      onSave({ kind, title: name, subtitle: String(data.get('email') || data.get('phone') || t('联系信息', 'Contact information')) })
    }
  }

  if (kind === 'import') {
    return (
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={t(...titles[kind])} closeLabel={t('关闭', 'Close')} className="vault-item-dialog vault-import-dialog">
        <div className="vault-form">
          <Upload size={23} />
          <p>{t('从 1Password、Chrome、Edge、Safari、Apple Passwords、Firefox、Bitwarden 或 LastPass 导出的 CSV 文件导入登录信息。', 'Import logins from a CSV file exported by 1Password, Chrome, Edge, Safari, Apple Passwords, Firefox, Bitwarden, or LastPass.')}</p>
          <p>{t('LastPass 导出文件也可包含卡片。', 'Cards come along from LastPass exports.')}<br />{t('文件仅在此设备上读取，不会上传。', 'The file is read on this device and never uploaded.')}</p>
          <footer className="dialog-footer"><Button variant="secondary" onClick={onClose}>{t('取消', 'Cancel')}</Button><Button onClick={() => fileRef.current?.click()}>{t('选择 CSV 文件', 'Choose CSV file')}</Button></footer>
          <input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" aria-label={t('选择 CSV 文件', 'Choose CSV file')} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImport(file) }} />
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={t(...titles[kind])} closeLabel={t('关闭', 'Close')} className={`vault-item-dialog vault-item-dialog--${kind}`}>
      <form className="vault-form" onSubmit={submit}>
        {kind === 'login' && (
          <>
            {Array.from({ length: websiteCount }, (_, index) => <label className="field-label" key={index}>{t('网站', 'Website')}<div className="input-with-icon"><Globe2 size={15} /><TextField name={index === 0 ? 'website' : `website${index}`} placeholder="example.com" required={index === 0} autoFocus={index === 0} spellCheck={false} /></div></label>)}
            <Button variant="ghost" size="sm" className="align-start" onClick={() => setWebsiteCount((count) => count + 1)}><Plus size={14} />{t('添加网站', 'Add website')}</Button>
            <label className="field-label">{t('用户名或邮箱（可选）', 'Username or email (Optional)')}<TextField name="username" placeholder="name@example.com" spellCheck={false} /></label>
            <label className="field-label">{t('密码', 'Password')}<TextField name="password" type="password" autoComplete="current-password" spellCheck={false} /></label>
            <label className="field-label">{t('提示（可选）', 'Hints (Optional)')}<TextField name="hints" spellCheck={spellcheck} /></label>
            <p className="field-help">{t('告诉 Bot 何时使用此条目', 'Tell Bot when to use this entry')}</p>
            <p className="field-help">{t('Grok Bot 可以使用此登录信息代你登录', 'Grok Bot can use this login to sign in for you')}</p>
          </>
        )}
        {kind === 'card' && (
          <>
            <div className="vault-scan-actions"><Button variant="secondary" onClick={() => onNotify(t('相机扫描为演示入口', 'Camera scanning is a demo entry'))}><Camera size={16} />{t('使用相机扫描', 'Scan with camera')}</Button><Button variant="secondary" onClick={() => onNotify(t('照片上传为演示入口', 'Photo upload is a demo entry'))}><ImagePlus size={16} />{t('上传照片', 'Upload a photo')}</Button></div>
            <div className="form-divider"><span>{t('或手动输入', 'or type it in')}</span></div>
            <label className="field-label">{t('卡号', 'Card number')}<TextField value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} inputMode="numeric" autoFocus placeholder="1234 5678 9012 3456" spellCheck={false} /></label>
            <div className="field-grid">
              <label className="field-label">{t('有效期', 'Expiry')}<TextField name="expiry" placeholder={t('月 / 年', 'MM / YY')} spellCheck={false} /></label>
              <label className="field-label">{t('安全码（可选）', 'Security code (Optional)')}<div className="input-with-action"><TextField name="code" type={showCode ? 'text' : 'password'} autoComplete="cc-csc" inputMode="numeric" spellCheck={false} /><IconButton label={showCode ? t('隐藏安全码', 'Hide security code') : t('显示安全码', 'Show security code')} onClick={() => setShowCode((value) => !value)}><Eye size={15} /></IconButton></div></label>
              <label className="field-label">{t('持卡人姓名（可选）', 'Name on card (Optional)')}<TextField name="cardName" spellCheck={spellcheck} /></label>
              <label className="field-label">{t('昵称（可选）', 'Nickname (Optional)')}<TextField name="nickname" placeholder={t('例如：旅行', 'e.g. Travel')} spellCheck={spellcheck} /></label>
            </div>
            <Button variant="secondary" onClick={() => setShowBilling((value) => !value)}><Plus size={15} />{t('添加账单地址（可选）', 'Add a billing address (Optional)')}</Button>
            {showBilling && <label className="field-label">{t('账单地址', 'Billing address')}<TextField name="billing" placeholder={t('街道、城市、邮政编码', 'Street, city, postal code')} spellCheck={spellcheck} /></label>}
            <label className="field-label">{t('提示（可选）', 'Hints (Optional)')}<TextField name="hints" spellCheck={spellcheck} /></label>
            <p className="field-help">{t('告诉 Bot 何时使用此条目', 'Tell Bot when to use this entry')}</p>
          </>
        )}
        {kind === 'contact' && (
          <>
            <label className="field-label">{t('姓名', 'Full name')}<TextField name="fullName" required autoFocus spellCheck={spellcheck} /></label>
            <label className="field-label">{t('地址', 'Address')}<TextField name="address" spellCheck={spellcheck} /></label>
            <label className="field-label">{t('地址第二行', 'Address line 2')}<TextField name="address2" spellCheck={spellcheck} /></label>
            <div className="field-grid">
              <label className="field-label">{t('城市', 'City')}<TextField name="city" spellCheck={spellcheck} /></label>
              <label className="field-label">{t('州或地区', 'State or region')}<TextField name="region" spellCheck={spellcheck} /></label>
              <label className="field-label">{t('邮政编码', 'ZIP or postal code')}<TextField name="postal" spellCheck={false} /></label>
              <label className="field-label">{t('国家', 'Country')}<Select label={t('国家或地区', 'Country or region')} value={country} onValueChange={setCountry} options={[{ value: 'cn', label: t('中国', 'China') }, { value: 'sg', label: t('新加坡', 'Singapore') }, { value: 'us', label: t('美国', 'United States') }]} /></label>
            </div>
            <label className="field-label">{t('电话', 'Phone')}<TextField name="phone" type="tel" spellCheck={false} /></label><span className="field-help">{t('添加电话', 'Add phone')}</span>
            <label className="field-label">{t('邮箱地址', 'Email address')}<TextField name="email" type="email" spellCheck={false} /></label><span className="field-help">{t('添加邮箱', 'Add email')}</span>
            <div className="field-grid"><label className="field-label">{t('标签', 'Label')}<TextField name="label" spellCheck={spellcheck} /></label><label className="field-label">{t('提示', 'Hints')}<TextField name="hints" spellCheck={spellcheck} /></label></div>
            <p className="field-help">{t('告诉 Bot 何时使用此条目', 'Tell Bot when to use this entry')}</p>
          </>
        )}
        <footer className="dialog-footer vault-form__footer">
          <span>{kind === 'card' ? t('Grok Bot 不会看到卡号', 'Grok Bot never sees the number') : ''}</span>
          <Button variant="secondary" onClick={onClose}>{t('取消', 'Cancel')}</Button>
          <Button type="submit" disabled={kind === 'card' && cardNumber.replace(/\s/g, '').length < 4}>{kind === 'login' ? t('保存登录信息', 'Save login') : kind === 'card' ? t('保存卡片', 'Save card') : t('保存联系信息', 'Save contact info')}</Button>
        </footer>
      </form>
    </Dialog>
  )
}
