import { useCallback, useEffect, useRef, useState } from 'react'
import { isCallError, isMyGo } from 'mygo-runtime'
import { Integrations, type IntegrationState } from '@/mygo'
import { useSettings } from '@/settings/SettingsProvider'
import { initialPrivateSkills } from './data'
import type { IntegrationStore, PrivateSkill } from './types'

const emptyState = (): IntegrationState => ({ configured: false, connections: [] })
const integrationErrorMessage = (err: unknown, fallback: string) => isCallError(err) ? err.message : fallback

export function useIntegrationStore(): IntegrationStore {
  const { profile, t } = useSettings()
  const profileID = profile?.id ?? ''
  const desktop = isMyGo()
  const [state, setState] = useState({ profileID, value: emptyState() })
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [privateSkills, setPrivateSkills] = useState(initialPrivateSkills)
  const currentProfile = useRef(profileID)
  const alive = useRef(true)
  const requestID = useRef(0)
  const mutating = useRef(false)
  const epoch = useRef(0)
  const translate = useRef(t)
  const awaitingApp = useRef('')
  currentProfile.current = profileID
  translate.current = t

  const refresh = useCallback(async (clearError = true) => {
    const request = ++requestID.current
    if (!desktop || !profileID) {
      setState({ profileID, value: emptyState() })
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const next = await Integrations.status(profileID)
      if (!alive.current || currentProfile.current !== profileID || requestID.current !== request) return
      setState({ profileID, value: { ...next, connections: next.connections.filter((item) => item.appId === 'github' || item.appId === 'vercel') } })
      if (next.connections.some((item) => item.appId === awaitingApp.current && item.status === 'ACTIVE')) {
        awaitingApp.current = ''
        setNotice('')
      }
      if (clearError && !mutating.current) setError('')
    } catch (err) {
      if (!alive.current || currentProfile.current !== profileID || requestID.current !== request) return
      setState((previous) => ({ profileID, value: { configured: previous.profileID === profileID && previous.value.configured, connections: [] } }))
      setError(translate.current('无法读取连接状态：', 'Could not read connection status: ') + integrationErrorMessage(err, translate.current('请稍后重试。', 'Please try again.')))
    } finally {
      if (alive.current && currentProfile.current === profileID && requestID.current === request) setLoading(false)
    }
  }, [desktop, profileID])

  useEffect(() => {
    alive.current = true
    epoch.current++
    setState({ profileID, value: emptyState() })
    setError('')
    setNotice('')
    setBusy(false)
    mutating.current = false
    awaitingApp.current = ''
    void refresh(false)
    const onFocus = () => { if (!mutating.current) void refresh(false) }
    const onVisible = () => { if (document.visibilityState === 'visible') onFocus() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      epoch.current++
      requestID.current++
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [profileID, refresh])

  const mutate = async (action: () => Promise<unknown>, openedAppId = '') => {
    if (!desktop || !profileID || mutating.current) return false
    const initiatingProfile = profileID
    const initiatingEpoch = epoch.current
    const isCurrent = () => alive.current && currentProfile.current === initiatingProfile && epoch.current === initiatingEpoch
    mutating.current = true
    setBusy(true)
    setError('')
    setNotice('')
    awaitingApp.current = ''
    requestID.current++
    try {
      await action()
      if (!isCurrent()) return false
      if (openedAppId) {
        awaitingApp.current = openedAppId
        setNotice(t('已在浏览器打开，完成后返回刷新。', 'Opened in your browser. Return and refresh after authorization.'))
      }
      await refresh(false)
      return isCurrent()
    } catch (err) {
      if (isCurrent()) {
        setError(t('操作失败：', 'Request failed: ') + integrationErrorMessage(err, t('请检查网络连接后重试。', 'Check your network connection and retry.')))
      }
      return false
    } finally {
      if (isCurrent()) {
        mutating.current = false
        setBusy(false)
        setLoading(false)
      }
    }
  }

  const value = state.profileID === profileID ? state.value : emptyState()
  const savePrivateSkill = (skill: PrivateSkill) => {
    setPrivateSkills((items) => items.map((item) => item.id === skill.id ? skill : item))
  }

  const deletePrivateSkill = (id: string) => {
    setPrivateSkills((items) => items.filter((item) => item.id !== id))
  }

  return {
    desktop,
    configured: value.configured,
    connections: value.connections,
    installedIds: [...new Set(value.connections.map((item) => item.appId))],
    connectedIds: [...new Set(value.connections.filter((item) => item.status === 'ACTIVE').map((item) => item.appId))],
    loading,
    busy,
    error,
    notice,
    privateSkills,
    refresh,
    configure: (apiKey) => mutate(() => Integrations.configureKey(apiKey)),
    connect: (appId) => mutate(() => Integrations.openConnect(profileID, appId), appId),
    disconnect: (connectionId) => mutate(() => Integrations.disconnect(profileID, connectionId)),
    savePrivateSkill,
    deletePrivateSkill,
  }
}
