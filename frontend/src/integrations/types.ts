import type { IntegrationConnection } from '@/mygo'

export type IntegrationCategory =
  | 'Password Managers'
  | 'Productivity'
  | 'Communication'
  | 'Design'
  | 'Code'
  | 'Data'
  | 'Sales'
  | 'Marketing'
  | 'Finance'
  | 'Research'
  | 'Support'
  | 'Team plugins'

export interface IntegrationSkill {
  id: string
  name: string
  description: string
}

export interface IntegrationApp {
  id: string
  name: string
  description: string
  category: IntegrationCategory
  developer: string
  website: string
  icon: string
  connectorName: string
  skills: IntegrationSkill[]
  recommended?: boolean
  team?: boolean
  available?: boolean
}

export interface PrivateSkill {
  id: string
  name: string
  description: string
  instructions: string
}

export interface IntegrationStore {
  installedIds: string[]
  connectedIds: string[]
  privateSkills: PrivateSkill[]
  desktop: boolean
  configured: boolean
  loading: boolean
  busy: boolean
  error: string
  notice: string
  connections: IntegrationConnection[]
  refresh: () => Promise<void>
  configure: (apiKey: string) => Promise<boolean>
  connect: (appId: string) => Promise<boolean>
  disconnect: (connectionId: string) => Promise<boolean>
  savePrivateSkill: (skill: PrivateSkill) => void
  deletePrivateSkill: (id: string) => void
}
