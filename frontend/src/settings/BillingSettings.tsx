import { useState } from 'react'
import { ArrowUpRight, Gift } from 'lucide-react'
import { Button } from '@/design-system'
import { ReferralDialog } from './ReferralDialog'
import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'

export function BillingSettings({ onNotify }: SettingsPageProps) {
  const [referralOpen, setReferralOpen] = useState(false)
  const [credits, setCredits] = useState(false)

  return (
    <div className="settings-scroll">
      <SettingCard className="usage-card">
        <span>Weekly usage limit</span>
        <div className="usage-card__value">20% <small>used</small></div>
        <div className="usage-card__track"><span /></div>
        <p>Resets in 5 days</p>
      </SettingCard>
      <p className="settings-note">Included usage with your subscription. Resets weekly.</p>
      <SettingSectionLabel>Usage limit resets</SettingSectionLabel>
      <SettingCard><SettingRow title="No resets available" description="Refer a friend for a free usage reset"><Button variant="secondary" onClick={() => setReferralOpen(true)}><Gift size={15} />Refer a Friend</Button></SettingRow></SettingCard>
      <SettingCard><SettingRow title="Additional usage credits"><Button className="blue-button" onClick={() => { setCredits((value) => !value); onNotify(credits ? '额外用量额度已停用（演示）' : '额外用量额度已启用（演示）') }}>{credits ? 'Disable' : 'Enable'}</Button></SettingRow></SettingCard>
      <p className="settings-note">Credits expire after two years</p>
      <SettingSectionLabel>Manage Plan</SettingSectionLabel>
      <SettingCard>
        <SettingRow title="Current plan: Premium" description="View, change, or upgrade your plan on cursor.com"><Button variant="secondary" onClick={() => onNotify('套餐管理为演示入口')}>Manage Plan<ArrowUpRight size={14} /></Button></SettingRow>
        <SettingRow title="Manage billing on Grok"><Button variant="secondary" onClick={() => onNotify('账单管理为演示入口')}>Manage Billing<ArrowUpRight size={14} /></Button></SettingRow>
      </SettingCard>
      {referralOpen && <ReferralDialog onClose={() => setReferralOpen(false)} onNotify={onNotify} />}
    </div>
  )
}
