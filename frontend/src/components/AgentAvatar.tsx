import { Sparkles } from 'lucide-react'
import type { AgentColor } from '@/types/chat'

const palette: Record<AgentColor, string> = {
  blue: '#4d8dff', orange: '#ff9a3c', green: '#55c981', purple: '#a779e9',
  teal: '#4db9a9', gray: '#858585', red: '#f15d62', white: '#f1f1ee', yellow: '#e9ae42',
}

interface AgentAvatarProps {
  color: AgentColor
  size?: number
  variant?: number
  badge?: boolean
  className?: string
}

export function AgentAvatar({ color, size = 36, variant = 0, badge = false, className = '' }: AgentAvatarProps) {
  const tilt = ((variant % 5) - 2) * 3
  const eyeY = 19 + (variant % 3)
  const path = variant % 3 === 0
    ? 'M32 3C46 3 57 12 59 27L61 42C62 53 53 60 42 60H20C9 60 3 52 4 41L6 23C8 10 18 3 32 3Z'
    : variant % 3 === 1
      ? 'M31 3C45 2 56 10 59 23C62 34 58 41 60 49C62 58 51 62 40 60L20 59C9 59 3 51 5 40L7 22C9 10 18 4 31 3Z'
      : 'M32 3C45 3 55 9 58 21L61 38C63 50 55 59 43 60L22 61C10 61 3 53 4 41L6 25C7 11 18 3 32 3Z'

  return (
    <span className={`agent-avatar ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size} style={{ transform: `rotate(${tilt}deg)` }}>
        <path d={path} fill={palette[color]} />
        <rect x="20" y={eyeY} width="6" height="16" rx="3" fill="#171717" transform={`rotate(12 23 ${eyeY + 8})`} />
        <rect x="37" y={eyeY - 1} width="6" height="16" rx="3" fill="#171717" transform={`rotate(12 40 ${eyeY + 7})`} />
      </svg>
      {badge && <span className="agent-avatar__badge"><Sparkles size={Math.max(10, size * 0.28)} strokeWidth={2.5} /></span>}
    </span>
  )
}
