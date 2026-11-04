import { useEffect, useId, useRef, useState } from 'react'
import { isCallError, isMyGo } from 'mygo-runtime'
import { Button, Dialog, Select, Switch, TextField } from '@/design-system'
import { Connections, type InstaboxSetup, type MachineCreation, type ModelConnection, type ModelOption } from '@/mygo'
import { useConnections } from './ConnectionProvider'
import { useSettings } from './SettingsProvider'

const emptyModel: ModelConnection = { api: 'openai-completions', baseUrl: '', modelId: '', noApiKey: false, supportsImages: false, reasoning: false, contextWindow: 128000, maxTokens: 16384 }

const presets = [
  { id: 'custom', label: 'OpenAI-compatible', api: 'openai-completions', baseUrl: '', noApiKey: false },
  { id: 'openai', label: 'OpenAI', api: 'openai-responses', baseUrl: 'https://api.openai.com/v1', noApiKey: false },
  { id: 'anthropic', label: 'Anthropic', api: 'anthropic-messages', baseUrl: 'https://api.anthropic.com', noApiKey: false },
  { id: 'google', label: 'Google Gemini', api: 'google-generative-ai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', noApiKey: false },
  { id: 'ollama', label: 'Ollama', api: 'openai-completions', baseUrl: 'http://localhost:11434/v1', noApiKey: true },
] as const

const apiOptions = [
  { value: 'openai-completions', label: 'OpenAI chat completions' },
  { value: 'openai-responses', label: 'OpenAI responses' },
  { value: 'anthropic-messages', label: 'Anthropic messages' },
  { value: 'google-generative-ai', label: 'Google generative AI' },
]

function presetFor(model?: ModelConnection): string {
  if (!model) return 'custom'
  const match = presets.find((p) => p.id !== 'custom' && p.api === model.api && p.baseUrl === model.baseUrl && p.noApiKey === model.noApiKey)
  return match?.id ?? 'custom'
}

function errorText(err: unknown): string {
  return isCallError(err) ? err.message : err instanceof Error ? err.message : String(err)
}

export function ModelConnectionForm({ onSaved }: { onSaved?: () => void }) {
  const { t } = useSettings()
  const { snapshot, setSnapshot } = useConnections()
  const native = isMyGo()
  const savedModel = snapshot?.modelConfigured ? snapshot.model : null
  const [draft, setDraft] = useState<ModelConnection>(() => savedModel ?? emptyModel)
  const [presetId, setPresetId] = useState(() => presetFor(savedModel ?? undefined))
  const [key, setKey] = useState('')
  const [options, setOptions] = useState<ModelOption[]>([])
  const [listNote, setListNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const modelInputId = useId()
  const modelListId = useId()
  // Keep user edits across unrelated snapshot updates: only adopt the saved
  // config when nothing was edited yet (draft still equals an older model).
  const [touched, setTouched] = useState(false)
  const mark = (next: Partial<ModelConnection>) => { setTouched(true); setDraft((d) => ({ ...d, ...next })) }

  // Adopt a newly loaded/saved model only while the draft is untouched.
  const [seenModel, setSeenModel] = useState(savedModel)
  if (savedModel !== seenModel) {
    setSeenModel(savedModel)
    if (!touched && savedModel) {
      setDraft(savedModel)
      setPresetId(presetFor(savedModel))
    }
  }

  const choosePreset = (id: string) => {
    const preset = presets.find((p) => p.id === id) ?? presets[0]
    setTouched(true)
    setPresetId(id)
    setKey('') // never carry a key into a different endpoint
    setOptions([])
    setListNote('')
    setDraft((d) => ({ ...d, api: preset.api, baseUrl: preset.baseUrl, noApiKey: preset.noApiKey }))
  }

  const loadModels = async () => {
    if (!native || loading) return
    setLoading(true)
    setListNote('')
    setError('')
    try {
      const list = await Connections.listModels(draft, key)
      setOptions(list)
      if (!list.length) setListNote(t('该服务没有返回模型列表，请手动填写模型 ID。', 'The service returned no models; enter the model ID manually.'))
    } catch (err) {
      setOptions([])
      setListNote(errorText(err))
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!native || busy) return
    setBusy(true)
    setError('')
    try {
      const next = await Connections.saveModel(draft, key)
      setKey('')
      setSnapshot(next)
      setTouched(false)
      onSaved?.()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const configured = snapshot?.modelConfigured ?? false
  // Endpoint edits always invalidate the typed key and any fetched options.
  const changeEndpoint = (patch: Partial<ModelConnection>) => {
    setTouched(true)
    setPresetId('custom')
    setKey('')
    setOptions([])
    setListNote('')
    setDraft((d) => ({ ...d, ...patch }))
  }

  const canSave = native && !busy && draft.baseUrl.trim() !== '' && draft.modelId.trim() !== '' &&
    (draft.noApiKey || key.trim() !== '' || (!snapshot?.legacyModel && (snapshot?.hasModelKey ?? false) && sameEndpoint(draft, savedModel)))

  return (
    <div className="connection-form">
      <h3>{t('模型服务', 'Model service')}</h3>
      {configured && (
        <p className="connection-help">
          {snapshot?.legacyModel
            ? t('当前使用应用内已有的模型配置，可直接聊天；如需更换服务请在下方重新输入密钥。', 'The existing in-app model configuration is in use and works; re-enter a key below only to change the connection.')
            : t('已配置模型服务。留空密钥并保持同一服务地址可沿用已保存的密钥。', 'A model service is configured. Leave the key blank on the same service address to keep the saved key.')}
        </p>
      )}
      <fieldset className="connection-fields" disabled={busy || loading}>
      <label className="connection-field">
        <span>{t('服务', 'Service')}</span>
        <Select value={presetId} onValueChange={choosePreset} label={t('服务', 'Service')} options={presets.map((p) => ({ value: p.id, label: p.label }))} />
      </label>
      <div className="connection-field-row">
        <label className="connection-field">
          <span>{t('协议', 'Protocol')}</span>
          <Select value={draft.api} onValueChange={(api) => changeEndpoint({ api })} label={t('协议', 'Protocol')} options={apiOptions} />
        </label>
        <label className="connection-field">
          <span>Base URL</span>
          <TextField value={draft.baseUrl} onChange={(e) => changeEndpoint({ baseUrl: e.target.value })} placeholder="https://…" autoComplete="off" spellCheck={false} />
        </label>
      </div>
      {!draft.noApiKey && (
        <label className="connection-field">
          <span>{t('API 密钥', 'API key')}</span>
          <TextField type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={snapshot?.legacyModel ? t('输入密钥以更换连接', 'Enter a key to change the connection') : configured ? t('留空则沿用已保存的密钥（仅同一服务地址）', 'Leave blank to keep the saved key (same endpoint only)') : ''} autoComplete="off" spellCheck={false} />
        </label>
      )}
      <label className="connection-check">
        <Switch label={t('此服务不需要 API 密钥（本地服务等）', 'This service does not need an API key (local service)')} checked={draft.noApiKey} onCheckedChange={(v) => { mark({ noApiKey: v }); if (v) setKey('') }} />
        <span>{t('此服务不需要 API 密钥（本地服务等）', 'This service does not need an API key (local service)')}</span>
      </label>
      <div className="connection-field">
        <label htmlFor={modelInputId}>{t('模型', 'Model')}</label>
        <div className="connection-inline">
          <TextField id={modelInputId} value={draft.modelId} onChange={(e) => mark({ modelId: e.target.value })} placeholder={t('模型 ID', 'Model ID')} list={modelListId} autoComplete="off" spellCheck={false} />
          <datalist id={modelListId}>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</datalist>
          <Button variant="secondary" size="sm" loading={loading} disabled={!native || !draft.baseUrl.trim()} onClick={loadModels}>{t('获取模型列表', 'Load models')}</Button>
        </div>
        {listNote && <p className="connection-help">{listNote}</p>}
      </div>
      <details className="connection-advanced">
        <summary>{t('高级设置', 'Advanced')}</summary>
        <div className="connection-field-row">
          <label className="connection-field">
            <span>{t('上下文窗口 (tokens)', 'Context window (tokens)')}</span>
            <TextField type="number" value={draft.contextWindow} onChange={(e) => mark({ contextWindow: Number(e.target.value) || 0 })} min={1024} />
          </label>
          <label className="connection-field">
            <span>{t('最大输出 (tokens)', 'Max output (tokens)')}</span>
            <TextField type="number" value={draft.maxTokens} onChange={(e) => mark({ maxTokens: Number(e.target.value) || 0 })} min={1} />
          </label>
        </div>
        <label className="connection-check">
          <Switch label={t('支持图片输入（理解远程桌面截图时需要）', 'Supports image input (needed to understand remote screenshots)')} checked={draft.supportsImages} onCheckedChange={(v) => mark({ supportsImages: v })} />
          <span>{t('支持图片输入（理解远程桌面截图时需要）', 'Supports image input (needed to understand remote screenshots)')}</span>
        </label>
        <label className="connection-check">
          <Switch label={t('模型支持推理（显示思考状态）', 'Model supports reasoning (shows thinking status)')} checked={draft.reasoning} onCheckedChange={(v) => mark({ reasoning: v })} />
          <span>{t('模型支持推理（显示思考状态）', 'Model supports reasoning (shows thinking status)')}</span>
        </label>
        <p className="connection-help">{t('这些上限需要与你的服务实际能力一致，填写错误会导致请求失败。', 'These limits must match what your service actually supports; wrong values will make requests fail.')}</p>
      </details>
      </fieldset>
      {error && <p className="connection-error" role="alert">{error}</p>}
      {!native && <p className="connection-help">{t('连接配置仅在桌面应用中可用。', 'Connection setup is only available in the desktop app.')}</p>}
      <div className="connection-actions">
        <Button loading={busy} disabled={!canSave} onClick={save}>{t('测试并保存', 'Test and save')}</Button>
        <span className="connection-help">{t('保存前会用你的服务做一次简短的真实请求验证连接，该服务可能按你的套餐计费。', 'Saving runs one short real request against your service to verify the connection; your provider may charge for it.')}</span>
      </div>
    </div>
  )
}

function sameEndpoint(draft: ModelConnection, saved: ModelConnection | null): boolean {
  return !!saved && saved.api === draft.api && saved.baseUrl === draft.baseUrl
}

// ---------- Computer ----------

const namePattern = /^[a-z0-9][a-z0-9-]{0,62}$/

export function ComputerConnectionForm({ onContinue, onBusyChange }: { onContinue?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const { t } = useSettings()
  const { snapshot, setSnapshot, refresh } = useConnections()
  const native = isMyGo()
  const mode = snapshot?.mode ?? 'chat'
  const [choice, setChoice] = useState<string>(mode)
  const [localConfirm, setLocalConfirm] = useState(false)
  const [key, setKey] = useState('')
  const [setup, setSetup] = useState<InstaboxSetup | null>(null)
  const [busy, setBusyState] = useState<string | null>(null)
  const setBusy = (v: string | null) => { setBusyState(v); onBusyChange?.(v != null) }
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [seenMode, setSeenMode] = useState(mode)
  if (seenMode !== mode) { setSeenMode(mode); setChoice(mode) }

  const pending = snapshot?.pendingCreation ?? null

  const pick = (next: string) => { if (busy) return; setChoice(next); setLocalConfirm(false); setError('') }

  const applyChat = async () => {
    if (!native || busy) return
    setBusy('mode'); setError('')
    try { setSnapshot(await Connections.setMode('chat')) } catch (err) { setError(errorText(err)) } finally { setBusy(null) }
  }

  const applyLocal = async () => {
    if (!native || busy || !localConfirm) return
    setBusy('mode'); setError('')
    try { setSnapshot(await Connections.setMode('local')) } catch (err) { setError(errorText(err)) } finally { setBusy(null) }
  }

  return (
    <div className="connection-form">
      <h3>{t('工作环境', 'Work environment')}</h3>
      <p className="connection-help">
        {t('当前模式：', 'Current mode: ')}
        {mode === 'remote' ? t('远程电脑', 'Remote computer') : mode === 'local' ? t('本机工具', 'This computer') : t('仅聊天', 'Chat only')}
      </p>
      <div className="mode-cards" role="radiogroup" aria-label={t('工作环境', 'Work environment')}>
        <button type="button" role="radio" aria-checked={choice === 'chat'} className={`mode-card ${choice === 'chat' ? 'is-active' : ''}`} onClick={() => pick('chat')}>
          <strong>{t('仅聊天', 'Chat only')}</strong>
          <p>{t('不开启电脑或应用工具，最安全的选择。', 'No computer or app tools; the safest choice.')}</p>
        </button>
        <button type="button" role="radio" aria-checked={choice === 'local'} className={`mode-card ${choice === 'local' ? 'is-active' : ''}`} onClick={() => pick('local')}>
          <strong>{t('本机', 'This computer')}</strong>
          <p>{t('Bot 可以用你的账户权限在这台电脑上读写文件、执行命令；工作目录 ~/morilo-workspace 不是沙箱。', 'The bot can read/write files and run commands on this Mac with your account permissions; the ~/morilo-workspace directory is not a sandbox.')}</p>
        </button>
        <button type="button" role="radio" aria-checked={choice === 'remote'} className={`mode-card ${choice === 'remote' ? 'is-active' : ''}`} onClick={() => pick('remote')}>
          <strong>{t('远程电脑（Instabox）', 'Remote computer (Instabox)')}</strong>
          <p>{t('使用你自己 Instabox 账户里的电脑，费用由你的账户承担。', 'Use a machine in your own Instabox account; charges are on your account.')}</p>
        </button>
      </div>
      {choice !== mode && <p className="connection-help">{t('所选模式在确认操作后才会启用。', 'The selected mode takes effect only after confirmation.')}</p>}
      {error && <p className="connection-error" role="alert">{error}</p>}
      {choice === 'chat' && mode !== 'chat' && (
        <div className="connection-actions"><Button loading={busy === 'mode'} disabled={!native} onClick={applyChat}>{t('切换到仅聊天', 'Switch to chat only')}</Button></div>
      )}
      {choice === 'local' && mode !== 'local' && (
        <div className="connection-actions">
          <label className="connection-check">
            <Switch label={t('confirm','confirm')} checked={localConfirm} onCheckedChange={setLocalConfirm} />
            <span>{t('我理解 Bot 将在本机执行命令并读写文件', 'I understand the bot will run commands and read/write files on this computer')}</span>
          </label>
          <Button loading={busy === 'mode'} disabled={!native || !localConfirm} onClick={applyLocal}>{t('启用本机工具', 'Enable this computer')}</Button>
        </div>
      )}
      {choice === 'remote' && <RemoteSetup onContinue={onContinue} busy={busy} setBusy={setBusy} error={error} setError={setError} setup={setup} setSetup={setSetup} apiKey={key} setKey={setKey} pending={pending} createOpen={createOpen} setCreateOpen={setCreateOpen} refresh={refresh} setSnapshot={setSnapshot} snapshot={snapshot} native={native} />}
      {!native && <p className="connection-help">{t('连接配置仅在桌面应用中可用。', 'Connection setup is only available in the desktop app.')}</p>}
    </div>
  )
}

interface RemoteSetupProps {
  onContinue?: () => void
  busy: string | null
  setBusy: (v: string | null) => void
  error: string
  setError: (v: string) => void
  setup: InstaboxSetup | null
  setSetup: (v: InstaboxSetup | null) => void
  apiKey: string
  setKey: (v: string) => void
  pending: MachineCreation | null
  createOpen: boolean
  setCreateOpen: (v: boolean) => void
  refresh: () => Promise<void>
  setSnapshot: (v: import('@/mygo').ConnectionSnapshot) => void
  snapshot: import('@/mygo').ConnectionSnapshot | null
  native: boolean
}

function RemoteSetup(props: RemoteSetupProps) {
  const { t } = useSettings()
  const { snapshot, setSetup, setError, setBusy, setKey, refresh, setSnapshot } = props
  const [listError, setListError] = useState('')
  const generation = useRef(0)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    listed.current = false
    return () => { alive.current = false; generation.current += 1 }
  }, [])

  const loadMachines = async () => {
    if (!props.native || props.busy) return
    const gen = ++generation.current
    setBusy('list'); setListError('')
    try {
      const next = await Connections.instaboxMachines()
      if (alive.current && gen === generation.current) { setSetup(next); setListError('') }
    } catch (err) {
      if (alive.current && gen === generation.current) setListError(errorText(err))
    } finally {
      if (alive.current && gen === generation.current) setBusy(null)
    }
  }

  // Load the machine list only when the remote section opens with a saved key.
  const listed = useRef(false)
  useEffect(() => {
    if (!props.native || listed.current || !(snapshot?.hasInstaboxKey || snapshot?.pendingCreation)) return
    listed.current = true
    void loadMachines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.native, snapshot?.hasInstaboxKey, snapshot?.pendingCreation])

  const configure = async () => {
    if (!props.native || props.busy || !props.apiKey.trim()) return
    setBusy('key'); setError(''); setListError('')
    try {
      const setup = await Connections.configureInstabox(props.apiKey.trim())
      setKey('')
      setSetup(setup)
      await refresh()
    } catch (err) {
      setError(errorText(err))
    } finally { setBusy(null) }
  }

  const connect = async (machineID: string) => {
    if (!props.native || props.busy) return
    setBusy('select'); setError('')
    try { setSnapshot(await Connections.selectMachine(machineID)) } catch (err) { setError(errorText(err)) } finally { setBusy(null) }
  }

  const setup = props.setup
  return (
    <div className="connection-form remote-setup">
      {snapshot?.connectionError && <p className="connection-error" role="alert">{snapshot.connectionError}</p>}
      {props.pending && <PendingCreation {...props} pending={props.pending} />}
      {!props.pending && (
        <div className="connection-field">
          <span>{snapshot?.hasInstaboxKey ? t('更换 Instabox API 密钥', 'Replace Instabox API key') : t('Instabox API 密钥', 'Instabox API key')}</span>
          <div className="connection-inline">
            <TextField type="password" value={props.apiKey} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder={snapshot?.hasInstaboxKey ? t('已保存密钥，输入新密钥可更换', 'A key is saved; enter a new one to replace it') : t('使用你账户的个人密钥', 'Use a personal key from your account')} />
            <Button variant="secondary" loading={props.busy === 'key'} disabled={!props.native || !props.apiKey.trim()} onClick={configure}>{t('连接账户', 'Connect account')}</Button>
          </div>
          <p className="connection-help">{t('密钥只保存在系统钥匙串，不会写入文件或日志。桌面访问需要创建机器所用的个人密钥。', 'The key is stored only in the system credential store, never in files or logs. Desktop access needs the personal key of the account that created the machine.')}</p>
        </div>
      )}
      {listError && (
        <div className="connection-field">
          <p className="connection-error" role="alert">{listError}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadMachines()}>{t('重试', 'Retry')}</Button>
        </div>
      )}
      {setup && (
        <div className="connection-field">
          <span>{t('账户', 'Account')}: {setup.account || t('已连接', 'connected')}</span>
          {setup.machines.length === 0 ? (
            <div className="connection-empty">
              <p>{t('此账户下还没有远程电脑。', 'There are no remote computers in this account yet.')}</p>
              <Button variant="secondary" disabled={!props.native || props.pending != null} onClick={() => props.setCreateOpen(true)}>{t('创建远程电脑', 'Create remote computer')}</Button>
            </div>
          ) : (
            <ul className="machine-list">
              {setup.machines.map((m) => (
                <li key={m.id} className="machine-item">
                  <div className="machine-item__info">
                    <strong>{m.name || m.id}</strong>
                    <span>{m.state}{m.runtime?.ready ? ` · ${t('就绪', 'ready')}` : ''}{m.spec?.vcpus ? ` · ${m.spec.vcpus} vCPU / ${m.spec.memMiB} MiB / ${m.spec.persistentDiskGiB} GiB` : ''}</span>
                  </div>
                  {snapshot?.machineId === m.id ? (
                    <span className="machine-item__selected">{t('已连接', 'Connected')}</span>
                  ) : (
                    <Button variant="secondary" size="sm" loading={props.busy === 'select'} disabled={!props.native || props.busy != null || props.pending != null} onClick={() => connect(m.id)}>{t('连接并启动', 'Connect and start')}</Button>
                  )}
                </li>
              ))}
              <li className="machine-item machine-item--create">
                <Button variant="ghost" size="sm" disabled={!props.native || props.pending != null} onClick={() => props.setCreateOpen(true)}>{t('创建远程电脑', 'Create remote computer')}</Button>
              </li>
            </ul>
          )}
        </div>
      )}
      {snapshot?.hasInstaboxKey && !setup && !listError && !props.pending && (
        <div className="connection-actions">
          <Button variant="secondary" loading={props.busy === 'list'} disabled={!props.native} onClick={() => void loadMachines()}>{t('列出机器', 'List machines')}</Button>
        </div>
      )}
      {props.createOpen && setup && <CreateMachineDialog {...props} setup={setup} />}
    </div>
  )
}

function PendingCreation({ pending, ...props }: RemoteSetupProps & { pending: MachineCreation }) {
  const { t } = useSettings()
  const [current, setCurrent] = useState<MachineCreation>(pending)
  const [stopped, setStopped] = useState(() => pending.state === 'failed' || !!pending.error)
  const [note, setNote] = useState('')
  const [dismissOpen, setDismissOpen] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const alive = useRef(true)
  const inFlight = useRef(false)
  const startedAt = useRef(0)

  async function step() {
    if (!alive.current || inFlight.current) return
    inFlight.current = true
    props.setBusy('poll')
    try {
      const next = await Connections.refreshCreation()
      if (!alive.current) return
      setCurrent(next)
      if (next.state === 'ready') {
        const snap = await Connections.get()
        if (!alive.current) return
        try {
          const setup = await Connections.instaboxMachines()
          if (!alive.current) return
          props.setSetup(setup)
        } catch (err) {
          if (!alive.current) return
          props.setError(errorText(err))
        }
        props.setSnapshot(snap)
        return
      }
      if (next.state === 'failed' || next.error) { setStopped(true); return }
      if (Date.now() - startedAt.current > 5 * 60 * 1000) {
        setStopped(true)
        setNote(t('仍在创建中；稍后点“恢复”继续跟踪。', 'Still provisioning; press Resume to keep tracking.'))
        return
      }
      timer.current = window.setTimeout(step, 2000)
    } catch (err) {
      if (!alive.current) return
      setStopped(true) // status check failed; pending record is preserved server-side
      setNote(errorText(err))
    } finally {
      inFlight.current = false
      props.setBusy(null)
    }
  }

  useEffect(() => {
    alive.current = true
    startedAt.current = Date.now()
    if (current.state !== 'ready' && current.state !== 'failed' && !stopped) {
      timer.current = window.setTimeout(step, 2000)
    }
    return () => { alive.current = false; window.clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resume = () => {
    if (inFlight.current) return
    window.clearTimeout(timer.current)
    setStopped(false)
    setNote('')
    startedAt.current = Date.now()
    void step()
  }
  const dismiss = async () => {
    if (inFlight.current || props.busy != null) return
    window.clearTimeout(timer.current)
    props.setBusy('dismiss')
    try { props.setSnapshot(await Connections.dismissCreation()); setDismissOpen(false) } catch (err) { props.setError(errorText(err)) } finally { props.setBusy(null) }
  }

  const labels: Record<string, [string, string]> = {
    submitting: ['正在提交创建请求…', 'Submitting the request…'],
    queued: ['排队等待创建…', 'Queued for creation…'],
    running: ['正在创建…', 'Creating…'],
    starting: ['正在启动机器…', 'Starting the machine…'],
    checking: ['正在检查桌面可用性…', 'Checking desktop availability…'],
    failed: ['创建失败', 'Creation failed'],
    ready: ['已就绪', 'Ready'],
  }
  const label = labels[current.state] ? t(...labels[current.state]) : current.state

  return (
    <div className="pending-creation" role="status">
      <strong>{t('正在创建远程电脑', 'Creating remote computer')}: {current.name}</strong>
      <p>{label}{current.error ? ` — ${current.error}` : ''}{note ? ` — ${note}` : ''}</p>
      <div className="connection-actions">
        {(stopped || current.state === 'failed') && <Button variant="secondary" size="sm" disabled={props.busy != null} onClick={resume}>{t('重试 / 恢复', 'Retry / resume')}</Button>}
        <Button variant="ghost" size="sm" disabled={props.busy != null} onClick={() => setDismissOpen(true)}>{t('停止跟踪', 'Dismiss')}</Button>
      </div>
      <Dialog open={dismissOpen} onOpenChange={setDismissOpen} title={t('停止跟踪创建？', 'Stop tracking this creation?')} description={t('只停止界面跟踪：已提交的机器不会被删除，可能继续按你的 Instabox 套餐计费。', 'This only stops tracking: an already-submitted machine is not deleted and may keep billing on your Instabox plan.')}>
        <div className="connection-actions">
          <Button variant="secondary" onClick={() => setDismissOpen(false)}>{t('继续等待', 'Keep waiting')}</Button>
          <Button variant="danger" loading={props.busy === 'dismiss'} onClick={dismiss}>{t('停止跟踪', 'Dismiss')}</Button>
        </div>
      </Dialog>
    </div>
  )
}

function CreateMachineDialog({ setup, ...props }: RemoteSetupProps & { setup: InstaboxSetup }) {
  const { t } = useSettings()
  const [name, setName] = useState('morilo-computer')
  const [error, setError] = useState('')
  const busy = props.busy === 'create'
  const valid = namePattern.test(name)
  const specKnown = setup.templateAvailable && setup.vcpus > 0 && setup.memoryMiB > 0 && setup.diskGiB > 0
  const canCreate = props.native && specKnown && valid && !busy && props.busy == null

  const create = async () => {
    if (!canCreate) return // one explicit POST per confirmation
    props.setBusy('create'); setError('')
    try {
      await Connections.createMachine(name)
      props.setSnapshot(await Connections.get())
      props.setCreateOpen(false)
    } catch (err) {
      setError(errorText(err))
      try {
        const next = await Connections.get()
        props.setSnapshot(next)
        if (next.pendingCreation) props.setCreateOpen(false)
      } catch { /* Keep the dialog open until the durable request is visible. */ }
    } finally { props.setBusy(null) }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!busy) props.setCreateOpen(open) }} title={t('创建远程电脑', 'Create remote computer')} description={t('将在你的 Instabox 账户创建并启动一台机器。', 'This creates and starts a machine in your Instabox account.')}>
      <div className="connection-form">
        <label className="connection-field">
          <span>{t('机器名称', 'Machine name')}</span>
          <TextField value={name} onChange={(e) => setName(e.target.value)} pattern="[a-z0-9][a-z0-9-]{0,62}" autoComplete="off" spellCheck={false} disabled={busy} />
          <span className="connection-help">{t('1–63 位小写字母、数字、连字符，需在你的账户中唯一。', '1–63 lowercase letters, digits and hyphens; must be unique in your account.')}</span>
        </label>
        <div className="connection-field">
          <span>{t('确认信息', 'Confirm')}</span>
          <ul className="connection-confirm">
            <li>{t('账户', 'Account')}: {setup.account || t('当前账户', 'current account')}</li>
            <li>{t('模板', 'Template')}: agent-browser{setup.templateAvailable ? '' : ` (${t('不可用', 'unavailable')})`}</li>
            {specKnown && <li>{t('规格', 'Spec')}: {setup.vcpus} vCPU / {setup.memoryMiB} MiB / {setup.diskGiB} GiB</li>}
            {setup.templateAvailable && !specKnown && <li>{t('规格以账户/API 返回为准', 'Spec as reported by the service')}</li>}
          </ul>
          <p className="connection-help">{t('将在你的 Instabox 账户创建并启动这台机器；额度和费用按你的套餐计算，Morilo 不收取该费用。', 'This creates and starts the machine in your Instabox account; usage and charges follow your Instabox plan — Morilo does not collect them.')}</p>
        </div>
        {error && <p className="connection-error" role="alert">{error}</p>}
        <div className="connection-actions">
          <Button variant="secondary" disabled={busy} onClick={() => props.setCreateOpen(false)}>{t('取消', 'Cancel')}</Button>
          <Button loading={busy} disabled={!canCreate} onClick={create}>{t('确认创建', 'Confirm and create')}</Button>
        </div>
      </div>
    </Dialog>
  )
}
