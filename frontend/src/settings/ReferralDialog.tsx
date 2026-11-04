import { Link, Mail, X } from 'lucide-react'
import { AgentAvatar } from '@/components/AgentAvatar'
import { Button, Dialog, IconButton } from '@/design-system'
import type { AgentColor } from '@/types/chat'
import { useSettings } from './SettingsProvider'

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
  const { t } = useSettings()
  const copyLink = async () => {
    try { await navigator.clipboard.writeText('https://github.com/hifizz/morilo') } catch { /* Clipboard may be unavailable in preview. */ }
    onNotify(t('项目地址已复制', 'Project link copied'))
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }} title={t('邀请好友使用 Morilo', 'Gift Morilo to a friend')} closeLabel={t('关闭', 'Close')} hideHeader className="referral-dialog">
      <div className="referral-friends" aria-hidden="true">{friends.map((friend, index) => <AgentAvatar key={index} color={friend.color} variant={friend.variant} size={58} />)}</div>
      <h2>{t('邀请好友使用 Morilo', 'Gift Morilo to a friend')}</h2>
      <p>{t('好友前 2 周免费使用。在其首次付款 7 天后，你可获得一次免费用量重置。', "Your friend's first 2 weeks are on us. Earn a free usage reset 7 days after their first payment.")} <button type="button" onClick={() => onNotify(t('邀请条款为演示内容', 'Referral terms are demo content'))}>{t('适用相关条款。', 'Terms apply.')}</button></p>
      <div className="referral-actions">
        <IconButton label={t('分享到 X', 'Share on X')} onClick={() => onNotify(t('已打开 X 分享（演示）', 'Opened sharing on X (demo)'))}><X size={19} /></IconButton>
        <IconButton label={t('邮件邀请', 'Invite by email')} onClick={() => onNotify(t('已生成邮件邀请（演示）', 'Email invitation created (demo)'))}><Mail size={19} /></IconButton>
        <Button size="lg" onClick={copyLink}><Link size={16} />{t('复制项目地址', 'Copy project link')}</Button>
      </div>
    </Dialog>
  )
}
