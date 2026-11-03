import { useState } from 'react'
import { ArrowUpRight, Gift } from 'lucide-react'
import { Button } from '@/design-system'
import { ReferralDialog } from './ReferralDialog'
import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'
import { useSettings } from './SettingsProvider'

export function BillingSettings({ onNotify }: SettingsPageProps) {
  const { t } = useSettings()
  const [referralOpen, setReferralOpen] = useState(false)
  const [credits, setCredits] = useState(false)

  return (
    <div className="settings-scroll">
      <SettingCard className="usage-card">
        <span>{t('每周用量限额', 'Weekly usage limit')}</span>
        <div className="usage-card__value">20% <small>{t('已使用', 'used')}</small></div>
        <div className="usage-card__track"><span /></div>
        <p>{t('5 天后重置', 'Resets in 5 days')}</p>
      </SettingCard>
      <p className="settings-note">{t('订阅包含的用量，每周重置。', 'Included usage with your subscription. Resets weekly.')}</p>
      <SettingSectionLabel>{t('用量限额重置', 'Usage limit resets')}</SettingSectionLabel>
      <SettingCard><SettingRow title={t('暂无可用重置次数', 'No resets available')} description={t('邀请好友可获得一次免费用量重置', 'Refer a friend for a free usage reset')}><Button variant="secondary" onClick={() => setReferralOpen(true)}><Gift size={15} />{t('邀请好友', 'Refer a Friend')}</Button></SettingRow></SettingCard>
      <SettingCard><SettingRow title={t('额外用量额度', 'Additional usage credits')}><Button className="blue-button" onClick={() => { setCredits((value) => !value); onNotify(credits ? t('额外用量额度已停用（演示）', 'Additional usage credits disabled (demo)') : t('额外用量额度已启用（演示）', 'Additional usage credits enabled (demo)')) }}>{credits ? t('停用', 'Disable') : t('启用', 'Enable')}</Button></SettingRow></SettingCard>
      <p className="settings-note">{t('额度将在两年后过期', 'Credits expire after two years')}</p>
      <SettingSectionLabel>{t('管理套餐', 'Manage Plan')}</SettingSectionLabel>
      <SettingCard>
        <SettingRow title={t('当前套餐：高级版', 'Current plan: Premium')} description={t('在 cursor.com 查看、更改或升级套餐', 'View, change, or upgrade your plan on cursor.com')}><Button variant="secondary" onClick={() => onNotify(t('套餐管理为演示入口', 'Plan management is a demo entry'))}>{t('管理套餐', 'Manage Plan')}<ArrowUpRight size={14} /></Button></SettingRow>
        <SettingRow title={t('在 Grok 管理账单', 'Manage billing on Grok')}><Button variant="secondary" onClick={() => onNotify(t('账单管理为演示入口', 'Billing management is a demo entry'))}>{t('管理账单', 'Manage Billing')}<ArrowUpRight size={14} /></Button></SettingRow>
      </SettingCard>
      {referralOpen && <ReferralDialog onClose={() => setReferralOpen(false)} onNotify={onNotify} />}
    </div>
  )
}
