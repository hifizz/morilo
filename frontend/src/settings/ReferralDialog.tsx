import { Link, Mail, X } from 'lucide-react'
import { AgentAvatar } from '@/components/AgentAvatar'
import { Button, Dialog, IconButton } from '@/design-system'
import type { AgentColor } from '@/types/chat'

interface ReferralDialogProps {
  onClose: () => void
  onNotify: (message: string) => void
}

const friends: { color: AgentColor; variant: number }[] = [
  { color: 'orange', variant: 2 }, { color: 'yellow', variant: 4 }, { color: 'white', variant: 0 },
  { color: 'teal', variant: 7 }, { color: 'purple', variant: 3 }, { color: 'red', variant: 10 },
  { color: 'blue', variant: 1 }, { color: 'gray', variant: 8 }, { color: 'yellow', variant: 12 },
]

export function ReferralDialog({ onClose, onNotify }: ReferralDialogProps) {
  const copyLink = async () => {
    try { await navigator.clipboard.writeText('https://grok.bot/refer/zilin-demo') } catch { /* Clipboard may be unavailable in preview. */ }
    onNotify('邀请链接已复制')
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title="Gift Grok Bot to a friend" hideHeader className="referral-dialog">
      <div className="referral-friends" aria-hidden="true">{friends.map((friend, index) => <AgentAvatar key={index} color={friend.color} variant={friend.variant} size={58} />)}</div>
      <h2>Gift Grok Bot to a friend</h2>
      <p>Your friend's first 2 weeks are on us. Earn a free usage reset 7 days after their first payment. <button type="button" onClick={() => onNotify('邀请条款为演示内容')}>Terms apply.</button></p>
      <div className="referral-actions">
        <IconButton label="分享到 X" onClick={() => onNotify('已打开 X 分享（演示）')}><X size={19} /></IconButton>
        <IconButton label="邮件邀请" onClick={() => onNotify('已生成邮件邀请（演示）')}><Mail size={19} /></IconButton>
        <Button size="lg" onClick={copyLink}><Link size={16} />Copy link</Button>
      </div>
    </Dialog>
  )
}
