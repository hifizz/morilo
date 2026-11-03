import type { CSSProperties, ReactNode } from 'react'
import { Github } from 'lucide-react'

interface IntegrationIconProps {
  icon: string
  size?: number
  className?: string
}

export function IntegrationIcon({ icon, size = 40, className = '' }: IntegrationIconProps) {
  const style: CSSProperties = { width: size, height: size, fontSize: Math.max(10, size * 0.4) }
  const classes = `integration-icon integration-icon--${icon.replace(/[^a-z0-9-]/g, '')} ${className}`

  const svg = (children: ReactNode) => (
    <span className={classes} style={style} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size * 0.72} height={size * 0.72} fill="none">{children}</svg>
    </span>
  )

  switch (icon) {
    case 'github':
      return <span className={classes} style={style} aria-hidden="true"><Github size={size * 0.62} /></span>
    case 'vercel':
      return svg(<path d="M20 7 34 32H6L20 7Z" fill="#050505" />)
    case 'supabase':
      return svg(<><path d="M22.8 5 10 22.2h9.1L17.2 35 30 17.8h-9.1L22.8 5Z" fill="#55C795" /><path d="m22.8 5-3.7 12.8H10L22.8 5Z" fill="#7BE0AC" /></>)
    case 'cloudflare':
      return svg(<><path d="M11 28.5h20.2c3.5 0 5.8-2.1 5.8-5.2 0-2.8-2-4.8-4.8-5.2-.5-5.1-4.3-8.6-9.2-8.6-4.8 0-8.7 3.4-9.5 8.3-4.6.1-8 2.7-8 5.8" fill="#F68B38" /><path d="M8 28.5h24" stroke="#FBB36B" strokeWidth="3" strokeLinecap="round" /></>)
    case 'firebase':
      return svg(<><path d="m9 29 3.5-21 6.2 11.5L9 29Z" fill="#FFC24B" /><path d="m9 29 9.7-9.5 4.2-8.2L31 29 9 29Z" fill="#F5820D" /><path d="m9 29 11-4.5L31 29 20 35 9 29Z" fill="#FCCA3F" /></>)
    case 'datadog':
      return svg(<><path d="M12 10h16v20H12z" fill="#7B61C9" /><path d="M15 13h3v3h-3zm7 0h3v3h-3zm-6 6h8v7h-8z" fill="white" /><path d="m12 13-4 5 4 3m16-8 4 5-4 3" stroke="#7B61C9" strokeWidth="2.5" /></>)
    case 'notion':
      return svg(<><path d="M9 7h20l3 3v23H12l-3-3V7Z" stroke="#111" strokeWidth="2" /><path d="M15 27V14l10 13V14" stroke="#111" strokeWidth="2.5" /><path d="M13 14h5m4 0h5M13 27h5m4 0h5" stroke="#111" strokeWidth="1.5" /></>)
    case 'atlassian':
      return svg(<><path d="M7 31 17 8c.8-1.7 2-1.6 2.5.1L28 31h-6l-7-13-4 13H7Z" fill="#4D8DFF" /><path d="M23 18c-.4-1.5.6-2.2 1.6-1L36 31h-7L23 18Z" fill="#2E6FE8" /></>)
    case '1password':
      return svg(<><circle cx="20" cy="20" r="14" fill="white" /><circle cx="20" cy="16" r="4" fill="#333" /><path d="M17.5 19h5l2 10h-9l2-10Z" fill="#333" /></>)
    case 'gmail':
      return svg(<><path d="M8 12v17h5V19l7 6 7-6v10h5V12l-12 9L8 12Z" fill="#EA4335" /><path d="m8 12 12 9 12-9-4-3-8 6-8-6-4 3Z" fill="#4285F4" /><path d="M8 12v17h5V19L8 12Z" fill="#34A853" /><path d="M27 19v10h5V12l-5 7Z" fill="#FBBC04" /></>)
    case 'linear':
      return svg(<><circle cx="20" cy="20" r="15" fill="white" /><path d="M8 24 24 8M10 29 29 10M16 32l16-16M8 19 19 8" stroke="#161616" strokeWidth="2" /></>)
    case 'context-dev':
      return svg(<><circle cx="15" cy="24" r="7" fill="white" /><rect x="15" y="10" width="16" height="16" rx="3" fill="white" /><path d="M19 13h9v9" stroke="#E8EEFF" strokeWidth="2" /></>)
    case 'sentry':
      return svg(<><path d="m20 7-12 21h6l6-11 6 11h6L20 7Z" stroke="white" strokeWidth="2.5" strokeLinejoin="round" /><path d="M12 28h16l-3-5H15l-3 5Z" fill="white" /></>)
    case 'redis':
      return <span className={classes} style={style} aria-hidden="true"><span className="integration-icon__word integration-icon__word--script">Redis</span></span>
    case 'aws':
      return svg(<><text x="20" y="19" textAnchor="middle" fill="#222" fontSize="11" fontWeight="700">aws</text><path d="M10 24c6 5 14 5 20 0" stroke="#F90" strokeWidth="2" strokeLinecap="round" /><path d="m27 23 3 1-2 3" stroke="#F90" strokeWidth="2" /></>)
    case 'mongodb':
      return svg(<><path d="M20 5c7 8 9 15 5 23l-5 7-5-7c-4-8-2-15 5-23Z" fill="#14964B" /><path d="M20 10v24" stroke="#C5E8D0" strokeWidth="1.5" /></>)
    case 'twilio':
      return svg(<><circle cx="20" cy="20" r="15" stroke="#E5484D" strokeWidth="3" /><circle cx="15" cy="15" r="3" fill="#E5484D" /><circle cx="25" cy="15" r="3" fill="#E5484D" /><circle cx="15" cy="25" r="3" fill="#E5484D" /><circle cx="25" cy="25" r="3" fill="#E5484D" /></>)
    case 'figma':
      return svg(<><path d="M14 6h6v10h-6a5 5 0 0 1 0-10Zm6 0h6a5 5 0 0 1 0 10h-6V6Zm-6 10h6v10h-6a5 5 0 0 1 0-10Z" fill="#F24E1E" /><path d="M20 16h6a5 5 0 0 1 0 10h-6V16Z" fill="#A259FF" /><path d="M14 26h6v4a5 5 0 1 1-6-4Z" fill="#0ACF83" /><circle cx="25" cy="21" r="5" fill="#1ABCFE" /></>)
    case 'slack':
      return svg(<><path d="M15 7v13M7 15h13M25 20v13M20 25h13" stroke="#36C5F0" strokeWidth="5" strokeLinecap="round" /><path d="M25 7v13M20 15h13" stroke="#2EB67D" strokeWidth="5" strokeLinecap="round" /><path d="M15 20v13M7 25h13" stroke="#ECB22E" strokeWidth="5" strokeLinecap="round" /></>)
    case 'stripe':
      return <span className={classes} style={style} aria-hidden="true"><strong>S</strong></span>
    case 'x':
      return <span className={classes} style={style} aria-hidden="true"><strong>𝕏</strong></span>
    case 'superpower':
      return svg(<><circle cx="20" cy="20" r="14" stroke="white" strokeWidth="2" /><path d="M20 6v28M6 20h28M10 10l20 20M30 10 10 30" stroke="white" strokeWidth="1.4" /><circle cx="20" cy="20" r="4" fill="white" /></>)
    case 'azure':
      return svg(<><path d="M18 6 6 31h10l4-9 5 9h9L18 6Z" fill="#4DB7E8" /><path d="m18 6-2 16h9l-7-16Z" fill="#2D91D4" /></>)
    case 'context7':
      return <span className={classes} style={style} aria-hidden="true"><strong>↯7</strong></span>
    default: {
      const label = icon === 'oz-harness' ? 'O' : icon === 'cloudflare-team' || icon === 'codex-team' ? 'C' : icon.charAt(0).toUpperCase()
      return <span className={classes} style={style} aria-hidden="true"><strong>{label}</strong></span>
    }
  }
}
