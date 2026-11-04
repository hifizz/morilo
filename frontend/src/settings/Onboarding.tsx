import { useMemo, useState } from 'react'
import { isCallError, isMyGo } from 'mygo-runtime'
import { Button, Select } from '@/design-system'
import { Connections } from '@/mygo'
import { useConnections } from './ConnectionProvider'
import { ComputerConnectionForm, ModelConnectionForm } from './ConnectionForms'
import { useSettings } from './SettingsProvider'
import './settings.css'

const steps = ['model', 'environment', 'finish'] as const
type Step = (typeof steps)[number]

export function Onboarding() {
  const { t, snapshot: settings, updatePreferences } = useSettings()
  const { snapshot, setSnapshot, loading, error, refresh } = useConnections()
  const native = isMyGo()
  const initial: Step = snapshot?.modelConfigured ? 'environment' : 'model'
  const [step, setStep] = useState<Step>(initial)
  const [busy, setBusy] = useState(false)
  const [envBusy, setEnvBusy] = useState(false)
  const [finishError, setFinishError] = useState('')

  const themeOptions = useMemo(() => [
    { value: 'system', label: t('跟随系统', 'System') },
    { value: 'light', label: t('浅色', 'Light') },
    { value: 'dark', label: t('深色', 'Dark') },
  ], [t])
  const languageOptions = useMemo(() => [
    { value: 'system', label: t('跟随系统', 'System') },
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' },
  ], [t])

  const finish = async () => {
    if (!native || busy) return
    setBusy(true)
    setFinishError('')
    try {
      setSnapshot(await Connections.finishOnboarding())
    } catch (err) {
      setFinishError(isCallError(err) ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  if (native && loading) {
    return <div className="onboarding"><div className="onboarding-card"><p>{t('正在读取连接配置…', 'Loading connections…')}</p></div></div>
  }
  if (native && error && !snapshot) {
    return (
      <div className="onboarding"><div className="onboarding-card">
        <p role="alert">{error}</p>
        <Button variant="secondary" onClick={() => void refresh()}>{t('重试', 'Retry')}</Button>
      </div></div>
    )
  }

  const index = steps.indexOf(step)
  const mode = snapshot?.mode ?? 'chat'
  const modeLabel = mode === 'remote' ? t('远程电脑', 'Remote computer') : mode === 'local' ? t('本机工具', 'This computer') : t('仅聊天', 'Chat only')

  return (
    <div className="onboarding">
      <header className="onboarding-topbar">
        <Select value={settings?.preferences.theme ?? 'system'} onValueChange={(theme) => updatePreferences({ theme })} label={t('主题', 'Theme')} options={themeOptions} />
        <Select value={settings?.preferences.language ?? 'system'} onValueChange={(language) => updatePreferences({ language })} label={t('语言', 'Language')} options={languageOptions} />
      </header>
      <div className="onboarding-card">
        <h1>Morilo</h1>
        <ol className="onboarding-steps" aria-label={t('设置步骤', 'Setup steps')}>
          {steps.map((s, i) => (
            <li key={s} className={i === index ? 'is-active' : i < index ? 'is-done' : ''}>
              <span>{i + 1}</span>
              {s === 'model' ? t('连接模型', 'Connect model') : s === 'environment' ? t('工作环境', 'Environment') : t('完成', 'Finish')}
            </li>
          ))}
        </ol>
        {step === 'model' && <ModelConnectionForm onSaved={() => setStep('environment')} />}
        {step === 'model' && snapshot?.modelConfigured && (
          <div className="connection-actions">
            <Button variant="ghost" onClick={() => setStep('environment')}>{t('跳过（已配置模型）', 'Skip (model already configured)')}</Button>
          </div>
        )}
        {step === 'environment' && (
          <>
            <ComputerConnectionForm onBusyChange={setEnvBusy} />
            {finishError && <p className="connection-error" role="alert">{finishError}</p>}
            <div className="connection-actions">
              <Button variant="ghost" disabled={envBusy} onClick={() => setStep('model')}>{t('返回', 'Back')}</Button>
              <Button variant="secondary" disabled={envBusy} onClick={() => setStep('finish')}>{mode === 'chat' ? t('继续', 'Continue') : t(`继续使用${modeLabel}`, `Continue with ${modeLabel}`)}</Button>
              {mode !== 'chat' && <Button variant="secondary" disabled={envBusy} onClick={async () => {
                if (!native) { setStep('finish'); return }
                try { setSnapshot(await Connections.setMode('chat')); setStep('finish') } catch (err) { setFinishError(isCallError(err) ? err.message : String(err)) }
              }}>{t('使用仅聊天', 'Use chat only')}</Button>}
            </div>
          </>
        )}
        {step === 'finish' && (
          <div className="connection-form">
            <h3>{t('一切就绪', 'All set')}</h3>
            <ul className="connection-confirm">
              <li>{t('模型', 'Model')}: {snapshot?.model?.modelId || t('未配置', 'not configured')}{snapshot?.model?.baseUrl ? ` · ${snapshot.model.baseUrl}` : ''}</li>
              <li>{t('工作环境', 'Environment')}: {modeLabel}{snapshot?.machineName ? ` · ${snapshot.machineName}` : ''}</li>
              <li>{t('GitHub/Vercel 等应用连接可以稍后从 Settings 里添加，不影响现在开始聊天。', 'App connections like GitHub/Vercel can be added later in Settings — they do not block chatting now.')}</li>
            </ul>
            {finishError && <p className="connection-error" role="alert">{finishError}</p>}
            <div className="connection-actions">
              <Button variant="ghost" onClick={() => setStep('environment')}>{t('返回', 'Back')}</Button>
              <Button loading={busy} disabled={!native} onClick={finish}>{t('开始使用 Morilo', 'Start using Morilo')}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
