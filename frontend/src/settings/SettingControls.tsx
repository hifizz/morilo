import type { ReactNode } from 'react'

interface SettingCardProps {
  children: ReactNode
  className?: string
}

export function SettingCard({ children, className = '' }: SettingCardProps) {
  return <section className={`setting-card ${className}`}>{children}</section>
}

interface SettingRowProps {
  title: string
  description?: string
  children?: ReactNode
  className?: string
}

export function SettingRow({ title, description, children, className = '' }: SettingRowProps) {
  return (
    <div className={`setting-row ${className}`}>
      <div className="setting-row__copy">
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="setting-row__control">{children}</div>}
    </div>
  )
}

export function SettingSectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="setting-section-label">{children}</h3>
}
