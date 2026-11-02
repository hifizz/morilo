import { useState } from 'react'
import {
  initialConnectedIntegrationIds,
  initialInstalledIntegrationIds,
  initialPrivateSkills,
} from './data'
import type { IntegrationStore, PrivateSkill } from './types'

export function useIntegrationStore(): IntegrationStore {
  const [installedIds, setInstalledIds] = useState(initialInstalledIntegrationIds)
  const [connectedIds, setConnectedIds] = useState(initialConnectedIntegrationIds)
  const [privateSkills, setPrivateSkills] = useState(initialPrivateSkills)

  const installApp = (id: string) => {
    setInstalledIds((items) => items.includes(id) ? items : [...items, id])
  }

  const uninstallApp = (id: string) => {
    setInstalledIds((items) => items.filter((item) => item !== id))
    setConnectedIds((items) => items.filter((item) => item !== id))
  }

  const connectApp = (id: string) => {
    setInstalledIds((items) => items.includes(id) ? items : [...items, id])
    setConnectedIds((items) => items.includes(id) ? items : [...items, id])
  }

  const disconnectApp = (id: string) => {
    setConnectedIds((items) => items.filter((item) => item !== id))
  }

  const savePrivateSkill = (skill: PrivateSkill) => {
    setPrivateSkills((items) => items.map((item) => item.id === skill.id ? skill : item))
  }

  const deletePrivateSkill = (id: string) => {
    setPrivateSkills((items) => items.filter((item) => item.id !== id))
  }

  return {
    installedIds,
    connectedIds,
    privateSkills,
    installApp,
    uninstallApp,
    connectApp,
    disconnectApp,
    savePrivateSkill,
    deletePrivateSkill,
  }
}
