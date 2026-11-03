import { useEffect, useRef, useState } from 'react'
import { Copy, FileUp, UserRound } from 'lucide-react'
import { Button, Select, Switch, TextArea, TextField } from '@/design-system'
import { isCallError } from 'mygo-runtime'
import type { Preferences } from '@/mygo'
import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import { useSettings } from './SettingsProvider'
import type { SettingsPageProps } from './types'

const msg = (err: unknown) => (isCallError(err) ? err.message : String(err))

export function GeneralSettings({ onNotify }: SettingsPageProps) {
  const { snapshot, profile, t, updatePreferences, createProfile, updateProfile, selectProfile, importMemory } = useSettings()
  const prefs = snapshot?.preferences
  const [name, setName] = useState(profile?.name ?? '')
  const [email, setEmail] = useState(profile?.email ?? '')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [micLevel, setMicLevel] = useState<number | null>(null)
  const micTest = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null)
  const [pendingImport, setPendingImport] = useState<{ filename: string; content: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(profile?.name ?? '')
    setEmail(profile?.email ?? '')
  }, [profile?.id])

  const updates = (patch: Partial<Preferences>) => {
    setError('')
    void updatePreferences(patch).catch((err) => setError(msg(err)))
  }
  const select = (id: string) => {
    setError('')
    void selectProfile(id).catch((err) => setError(msg(err)))
  }

  const refreshDevices = async () => {
    try {
      const seen = new Set<string>()
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === 'audioinput' && d.deviceId !== '' && d.deviceId !== 'default' && d.deviceId !== 'communications' && !seen.has(d.deviceId) && seen.add(d.deviceId),
      )
      setDevices(list)
    } catch (err) {
      setError(msg(err))
    }
  }
  useEffect(() => {
    void refreshDevices()
  }, [])

  const generation = useRef(0)
  const [micPending, setMicPending] = useState(false)
  const stopMicTest = () => {
    generation.current += 1
    setMicPending(false)
    const current = micTest.current
    if (!current) {
      setMicLevel(null)
      return
    }
    cancelAnimationFrame(current.raf)
    current.stream.getTracks().forEach((track) => track.stop())
    if (current.ctx.state !== 'closed') void current.ctx.close()
    micTest.current = null
    setMicLevel(null)
  }
  useEffect(() => () => stopMicTest(), [])
  useEffect(() => {
    stopMicTest()
  }, [prefs?.microphoneId])
  useEffect(() => {
    const onDeviceChange = () => {
      if (micTest.current) stopMicTest()
      void refreshDevices()
    }
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange)
  }, [])

  const startMicTest = async () => {
    setError('')
    stopMicTest()
    const mine = ++generation.current
    setMicPending(true)
    setMicLevel(0)
    let stream: MediaStream | undefined
    let ctx: AudioContext | undefined
    try {
      const id = prefs?.microphoneId
      stream = await navigator.mediaDevices.getUserMedia({ audio: id && id !== 'default' ? { deviceId: { exact: id } } : true })
      if (mine !== generation.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      ctx = new AudioContext()
      micTest.current = { stream, ctx, raf: 0 }
      if (ctx.state === 'suspended') {
        await ctx.resume()
        if (mine !== generation.current) {
          stream.getTracks().forEach((track) => track.stop())
          if ((ctx.state as string) !== 'closed') void ctx.close()
          return
        }
      }
      const audioCtx = ctx
      const mediaStream = stream
      const analyser = audioCtx.createAnalyser()
      audioCtx.createMediaStreamSource(mediaStream).connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128))
        setMicLevel(Math.min(1, peak / 60))
        if (micTest.current) micTest.current.raf = requestAnimationFrame(tick)
      }
      if (micTest.current?.ctx === audioCtx) micTest.current.raf = requestAnimationFrame(tick)
      void refreshDevices()
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop())
      if (ctx && ctx.state !== 'closed') void ctx.close()
      if (micTest.current?.ctx === ctx) micTest.current = null
      if (mine === generation.current) {
        setMicLevel(null)
        setError(msg(err))
      }
    } finally {
      if (mine === generation.current) setMicPending(false)
    }
  }

  const pickFile = (file: File) => {
    setError('')
    if (file.size > 64 << 10) {
      setError(t('文件超过 64KB 上限', 'File exceeds the 64KB limit'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const content = String(reader.result ?? '')
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          JSON.parse(content)
        } catch {
          setError(t('JSON 无效', 'Invalid JSON file'))
          return
        }
      }
      setPendingImport({ filename: file.name, content })
    }
    reader.onerror = () => setError(t('读取文件失败', 'Could not read the file'))
    reader.readAsText(file)
  }

  const confirmImport = async () => {
    if (!pendingImport || !profile) return
    try {
      await importMemory(profile.id, pendingImport.filename, pendingImport.content)
      setPendingImport(null)
      onNotify(t('记忆已导入', 'Memory imported'))
    } catch (err) {
      setError(msg(err))
    }
  }

  const saveProfile = async () => {
    if (!profile) return
    setError('')
    try {
      await updateProfile(profile.id, name, email)
      onNotify(t('本地资料已保存', 'Local profile saved'))
    } catch (err) {
      setError(msg(err))
    }
  }

  const addProfile = async () => {
    setError('')
    try {
      await createProfile(newName, newEmail)
      setAdding(false)
      setNewName('')
      setNewEmail('')
      onNotify(t('已切换到新本地资料', 'Switched to the new local profile'))
    } catch (err) {
      setError(msg(err))
    }
  }

  const copyEmail = async () => {
    setError('')
    try {
      await navigator.clipboard.writeText(profile?.email ?? '')
      onNotify(t('邮箱地址已复制', 'Email copied'))
    } catch (err) {
      setError(msg(err))
    }
  }

  if (!prefs) return null
  const micOptions = [
    { value: 'default', label: t('系统默认', 'System default') },
    ...devices.map((d) => ({ value: d.deviceId, label: d.label || t('麦克风设备', 'Microphone') })),
    { value: 'disabled', label: t('禁用', 'Disabled') },
  ]
  const tzOptions = [
    { value: 'auto', label: t(`自动（${Intl.DateTimeFormat().resolvedOptions().timeZone}）`, `Auto (${Intl.DateTimeFormat().resolvedOptions().timeZone})`) },
    { value: 'UTC', label: 'UTC' },
    ...Intl.supportedValuesOf('timeZone').filter((tz) => tz !== 'UTC').map((tz) => ({ value: tz, label: tz })),
  ]
  return (
    <div className="settings-scroll">
      {error && <p className="settings-error">{error}</p>}
      <SettingSectionLabel>{t('本地资料', 'Local profile')}</SettingSectionLabel>
      <SettingCard className="account-card">
        <span className="account-avatar"><UserRound size={23} /></span>
        <div className="account-card__identity">
          <strong>{profile?.name ?? t('未登录', 'Signed out')}</strong>
          <span>{profile?.email || t('本地资料 · 未绑定云端账户', 'Local profile · no cloud account')}
            {profile?.email ? <button type="button" aria-label={t('复制邮箱', 'Copy email')} onClick={copyEmail}><Copy size={12} /></button> : null}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setAdding((v) => !v)}>{adding ? t('取消', 'Cancel') : t('添加本地资料', 'Add local profile')}</Button>
        <Button variant="ghost" size="sm" onClick={() => select('')}>{t('退出', 'Sign out')}</Button>
      </SettingCard>
      {profile && (
        <SettingCard>
          <SettingRow title={t('昵称', 'Name')}><TextField spellCheck={prefs?.spellcheck ?? true} value={name} onChange={(e) => setName(e.target.value)} /></SettingRow>
          <SettingRow title={t('邮箱（仅展示，非登录凭据）', 'Email (display only)')}><TextField spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} /></SettingRow>
          <SettingRow title=""><Button size="sm" onClick={() => void saveProfile()}>{t('保存', 'Save')}</Button></SettingRow>
          {(snapshot?.profiles.length ?? 0) > 1 && (
            <SettingRow title={t('切换本地资料', 'Switch local profile')}>
              <Select label={t('本地资料', 'Local profile')} value={profile.id} onValueChange={(id) => select(id)} options={(snapshot?.profiles ?? []).map((p) => ({ value: p.id, label: p.name }))} />
            </SettingRow>
          )}
        </SettingCard>
      )}
      {adding && (
        <SettingCard>
          <SettingRow title={t('昵称', 'Name')}><TextField spellCheck={prefs?.spellcheck ?? true} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('新本地资料名称', 'New local profile name')} /></SettingRow>
          <SettingRow title={t('邮箱（可选）', 'Email (optional)')}><TextField spellCheck={false} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></SettingRow>
          <SettingRow title=""><Button size="sm" onClick={() => void addProfile()}>{t('创建并切换', 'Create & switch')}</Button></SettingRow>
        </SettingCard>
      )}

      <SettingSectionLabel>{t('外观', 'Appearance')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow title={t('主题', 'Theme')}><Select label={t('主题', 'Theme')} value={prefs.theme} onValueChange={(theme) => updates({ theme })} options={[{ value: 'system', label: t('跟随系统', 'Follow System') }, { value: 'light', label: t('浅色', 'Light') }, { value: 'dark', label: t('深色', 'Dark') }]} /></SettingRow>
        <SettingRow title={t('强调色', 'Accent')}><Select label={t('强调色', 'Accent')} value={prefs.accent} onValueChange={(accent) => updates({ accent })} options={[{ value: 'bot', label: t('Bot 颜色', 'Bot color') }, { value: 'blue', label: t('蓝色', 'Blue') }, { value: 'neutral', label: t('中性', 'Neutral') }]} /></SettingRow>
        <SettingRow title={t('语言', 'Language')}><Select label={t('语言', 'Language')} value={prefs.language} onValueChange={(language) => updates({ language })} options={[{ value: 'system', label: t('跟随系统', 'Follow System') }, { value: 'en', label: 'English' }, { value: 'zh', label: '简体中文' }]} /></SettingRow>
        <SettingRow title={t('输入时检查拼写', 'Check spelling while typing')}><Switch label={t('输入时检查拼写', 'Check spelling')} checked={prefs.spellcheck} onCheckedChange={(spellcheck) => updates({ spellcheck })} /></SettingRow>
      </SettingCard>

      <SettingSectionLabel>{t('系统', 'System')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow title={t('麦克风', 'Microphone')}>
          <Select label={t('麦克风', 'Microphone')} value={prefs.microphoneId} onValueChange={(microphoneId) => updates({ microphoneId })} options={micOptions} />
        </SettingRow>
        <SettingRow title={t('测试麦克风', 'Test microphone')} description={t('仅本地检测输入电平，不上传音频', 'Local input level check only, audio is not uploaded')}>
          <Button variant="secondary" size="sm" disabled={prefs.microphoneId === 'disabled' || micPending} onClick={() => (micTest.current ? stopMicTest() : void startMicTest())}>
            {micTest.current ? t('停止测试', 'Stop test') : t('测试麦克风', 'Test microphone')}
          </Button>
        </SettingRow>
        {micLevel !== null && (
          <div className="mic-meter" aria-label={t('麦克风输入电平', 'Microphone input level')}><span style={{ width: `${Math.round(micLevel * 100)}%` }} /></div>
        )}
        <SettingRow title={t('硬件加速', 'Use hardware acceleration')} description={t('由 macOS/WebKit 管理；当前版本不支持切换', 'Managed by macOS/WebKit; cannot be toggled in this version')}>
          <Switch label={t('硬件加速', 'Hardware acceleration')} checked disabled onCheckedChange={() => {}} />
        </SettingRow>
      </SettingCard>

      <SettingSectionLabel>{t('Bot', 'Bot')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow title={t('时区', 'Timezone')}><Select label={t('时区', 'Timezone')} value={prefs.timezone} onValueChange={(timezone) => updates({ timezone })} options={tzOptions} /></SettingRow>
      </SettingCard>

      <SettingSectionLabel>{t('导入记忆', 'Import memory')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow title={t('导入记忆到 Grok Bot', 'Import memory to Grok Bot')} description={t('把其他 AI 助手的偏好与上下文迁移到当前本地资料，仅支持 .txt / .md / .json', 'Bring preferences and context from another AI assistant into this local profile (.txt / .md / .json only)')}>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><FileUp size={14} />{t('选择文件', 'Choose file')}</Button>
        </SettingRow>
        {pendingImport && (
          <div className="memory-import">
            <strong>{pendingImport.filename}</strong>
            <TextArea value={pendingImport.content} readOnly rows={6} spellCheck={false} />
            <div className="memory-import__actions">
              <Button size="sm" onClick={() => void confirmImport()}>{t('确认导入', 'Confirm import')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setPendingImport(null)}>{t('取消', 'Cancel')}</Button>
            </div>
          </div>
        )}
        {profile?.memory && (
          <details className="memory-summary">
            <summary>{t(`已导入记忆 ${profile.memory.length} 字符`, `Imported memory: ${profile.memory.length} chars`)}</summary>
            <pre>{profile.memory}</pre>
          </details>
        )}
      </SettingCard>
      <input ref={fileRef} className="visually-hidden" type="file" accept=".txt,.md,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = '' }} />

      <SettingSectionLabel>{t('安全密钥', 'Security key')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow title={t('使用硬件安全密钥', 'Use hardware security keys')} description={t('尚未接入硬件密钥认证', 'Hardware key authentication is not integrated yet')}>
          <Switch label={t('硬件安全密钥', 'Security key')} checked={false} disabled onCheckedChange={() => {}} />
        </SettingRow>
      </SettingCard>
    </div>
  )
}
