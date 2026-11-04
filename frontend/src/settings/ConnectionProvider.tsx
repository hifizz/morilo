import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { isMyGo } from 'mygo-runtime'
import { Connections, type ConnectionSnapshot } from '@/mygo'

interface ConnectionContextValue {
  snapshot: ConnectionSnapshot | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
  setSnapshot: (next: ConnectionSnapshot) => void
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null)

// In a plain browser there is no Go backend: show an in-memory empty,
// non-secret snapshot so onboarding/Settings can be reviewed. It never
// reports a connected model or stores credentials.
const browserSnapshot: ConnectionSnapshot = {
  model: { api: 'openai-completions', baseUrl: '', modelId: '', noApiKey: false, supportsImages: false, reasoning: false, contextWindow: 128000, maxTokens: 16384 },
  modelConfigured: false,
  legacyModel: false,
  hasModelKey: false,
  hasInstaboxKey: false,
  machineId: '',
  machineName: '',
  mode: 'chat',
  onboardingComplete: false,
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ConnectionSnapshot | null>(isMyGo() ? null : browserSnapshot)
  const [loading, setLoading] = useState(isMyGo())
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!isMyGo()) return
    try {
      const next = await Connections.get()
      setSnapshot(next)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    if (!isMyGo()) return
    Connections.get()
      .then((next) => { if (mounted) { setSnapshot(next); setError('') } })
      .catch((err) => { if (mounted) setError(err instanceof Error ? err.message : String(err)) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <ConnectionContext.Provider value={{ snapshot, loading, error, refresh, setSnapshot }}>
      {children}
    </ConnectionContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConnections(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext)
  if (!ctx) throw new Error('useConnections must be used inside ConnectionProvider')
  return ctx
}
