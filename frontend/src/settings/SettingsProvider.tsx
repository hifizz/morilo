import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isMyGo } from 'mygo-runtime'
import { Settings, type LocalProfile, type Preferences, type SettingsSnapshot } from '@/mygo'

interface SettingsContextValue {
  snapshot: SettingsSnapshot | null
  profile: LocalProfile | undefined
  loading: boolean
  error: string
  retry: () => void
  locale: 'zh' | 'en'
  t: (zh: string, en: string) => string
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>
  createProfile: (name: string, email: string) => Promise<void>
  updateProfile: (id: string, name: string, email: string) => Promise<void>
  selectProfile: (id: string) => Promise<void>
  importMemory: (id: string, filename: string, content: string) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const STORAGE_KEY = 'grokbot-settings'
const MAX_MEMORY = 64 << 10

const fallbackSnapshot = (): SettingsSnapshot => {
  const profile = { id: crypto.randomUUID(), name: '本地用户', email: '', memory: '' }
  return {
    preferences: { theme: 'system', accent: 'bot', language: 'system', spellcheck: true, microphoneId: 'default', timezone: 'auto' },
    profiles: [profile],
    activeProfileId: profile.id,
  }
}

const systemZh = () => (navigator.languages?.[0] ?? navigator.language).toLowerCase().startsWith('zh')

const validName = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('昵称不能为空')
  if ([...trimmed].length > 80) throw new Error('昵称过长')
  return trimmed
}

const buildMemory = (existing: string, filename: string, content: string) => {
  const lower = filename.toLowerCase()
  let normalized: string
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    normalized = content.replace(/\r\n/g, '\n').trim()
    if (!normalized) throw new Error('导入内容为空')
  } else if (lower.endsWith('.json')) {
    JSON.parse(content)
    normalized = content.trim()
  } else {
    throw new Error('仅支持 .txt / .md / .json 文件')
  }
  const base = filename.split('/').pop()!.split('\\').pop()! || 'memory.txt'
  const merged = existing ? `${existing}\n\n## ${base}\n${normalized}` : `## ${base}\n${normalized}`
  if (new TextEncoder().encode(merged).length > MAX_MEMORY) throw new Error('导入后记忆超过 64KB 上限')
  return merged
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const inApp = isMyGo()
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sysLangTick, setSysLangTick] = useState(0)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const snapshotRef = useRef<SettingsSnapshot | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    if (inApp) {
      Settings.get()
        .then((next) => { snapshotRef.current = next; setSnapshot(next) })
        .catch((err) => setError(err?.message ?? String(err)))
        .finally(() => setLoading(false))
    } else {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === null) {
          const initial = fallbackSnapshot()
          localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
          snapshotRef.current = initial
          setSnapshot(initial)
        } else {
          const parsed = JSON.parse(raw) as SettingsSnapshot
          if (!parsed?.profiles?.length || !parsed.preferences) throw new Error('bad snapshot')
          snapshotRef.current = parsed
          setSnapshot(parsed)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
      setLoading(false)
    }
  }, [inApp])
  useEffect(load, [load])

  useEffect(() => {
    const onLang = () => setSysLangTick((v) => v + 1)
    window.addEventListener('languagechange', onLang)
    return () => window.removeEventListener('languagechange', onLang)
  }, [])

  const persistBrowser = useCallback(
    (next: SettingsSnapshot) => {
      if (!inApp) localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      snapshotRef.current = next
      setSnapshot(next)
    },
    [inApp],
  )

  const run = useCallback(
    (op: () => Promise<SettingsSnapshot>) => {
      const task = chain.current.then(op).then(persistBrowser)
      chain.current = task.then(() => undefined, () => undefined)
      return task.then(() => undefined)
    },
    [persistBrowser],
  )
  const browserOp = useCallback(
    (mutate: (snap: SettingsSnapshot) => SettingsSnapshot) =>
      run(() => {
        const current = snapshotRef.current
        if (!current) return Promise.reject(new Error('settings not loaded'))
        return Promise.resolve(mutate(current))
      }),
    [run],
  )

  const updatePreferences = useCallback(
    (patch: Partial<Preferences>) =>
      run(() => {
        const current = snapshotRef.current
        if (!current) return Promise.reject(new Error('settings not loaded'))
        const next = { ...current, preferences: { ...current.preferences, ...patch } }
        return inApp ? Settings.updatePreferences(next.preferences) : Promise.resolve(next)
      }),
    [inApp, run],
  )
  const createProfile = useCallback(
    (name: string, email: string) => {
      const trimmed = validName(name)
      if (inApp) return run(() => Settings.createProfile(name, email))
      return browserOp((snap) => {
        const profile = { id: crypto.randomUUID(), name: trimmed, email: email.trim(), memory: '' }
        return { ...snap, profiles: [...snap.profiles, profile], activeProfileId: profile.id }
      })
    },
    [inApp, run, browserOp],
  )
  const updateProfile = useCallback(
    (id: string, name: string, email: string) => {
      const trimmed = validName(name)
      if (inApp) return run(() => Settings.updateProfile(id, name, email))
      return browserOp((snap) => ({ ...snap, profiles: snap.profiles.map((p) => (p.id === id ? { ...p, name: trimmed, email: email.trim() } : p)) }))
    },
    [inApp, run, browserOp],
  )
  const selectProfile = useCallback(
    (id: string) => {
      if (inApp) return run(() => Settings.selectProfile(id))
      return browserOp((snap) => {
        if (id && !snap.profiles.some((p) => p.id === id)) throw new Error('unknown local profile')
        return { ...snap, activeProfileId: id }
      })
    },
    [inApp, run, browserOp],
  )
  const importMemory = useCallback(
    (id: string, filename: string, content: string) => {
      if (inApp) return run(() => Settings.importMemory(id, filename, content))
      return browserOp((snap) => ({
        ...snap,
        profiles: snap.profiles.map((p) => (p.id === id ? { ...p, memory: buildMemory(p.memory, filename, content) } : p)),
      }))
    },
    [inApp, run, browserOp],
  )

  const locale: 'zh' | 'en' = useMemo(() => {
    const lang = snapshot?.preferences.language ?? 'system'
    if (lang === 'zh' || lang === 'en') return lang
    void sysLangTick
    return systemZh() ? 'zh' : 'en'
  }, [snapshot?.preferences.language, sysLangTick])
  const t = useCallback((zh: string, en: string) => (locale === 'zh' ? zh : en), [locale])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  useEffect(() => {
    const theme = snapshot?.preferences.theme ?? 'system'
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = resolved
      document.documentElement.style.colorScheme = resolved
    }
    apply()
    if (theme === 'system') {
      media.addEventListener('change', apply)
      return () => media.removeEventListener('change', apply)
    }
  }, [snapshot?.preferences.theme])

  const value = useMemo<SettingsContextValue>(
    () => ({
      snapshot,
      profile: snapshot?.profiles.find((p) => p.id === snapshot.activeProfileId),
      loading,
      error,
      retry: load,
      locale,
      t,
      updatePreferences,
      createProfile,
      updateProfile,
      selectProfile,
      importMemory,
    }),
    [snapshot, loading, error, load, locale, t, updatePreferences, createProfile, updateProfile, selectProfile, importMemory],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings outside SettingsProvider')
  return ctx
}
