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
  installApp: (id: string) => void
  uninstallApp: (id: string) => void
  connectApp: (id: string) => void
  disconnectApp: (id: string) => void
  savePrivateSkill: (skill: PrivateSkill) => void
  deletePrivateSkill: (id: string) => void
}
