export type SettingsSection = 'general' | 'computer' | 'permissions' | 'vault' | 'billing' | 'updates'

export interface SettingsPageProps {
  onNotify: (message: string) => void
}
