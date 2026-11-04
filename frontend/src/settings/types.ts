export type SettingsSection = 'general' | 'model' | 'computer' | 'updates'

export interface SettingsPageProps {
  onNotify: (message: string) => void
}
