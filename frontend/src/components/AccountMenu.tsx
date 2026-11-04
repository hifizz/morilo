import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronRight, CircleHelp, Gift, LogOut, Plus, Settings, Smartphone } from 'lucide-react'
import type { ReactNode } from 'react'
import { isCallError } from 'mygo-runtime'
import { useSettings } from '@/settings/SettingsProvider'

interface AccountMenuProps {
  children: ReactNode
  collapsed?: boolean
  onOpenSettings: (section: 'general' | 'billing') => void
  onNotify: (message: string) => void
}

const itemClass = 'account-menu__item'

export function AccountMenu({ children, collapsed, onOpenSettings, onNotify }: AccountMenuProps) {
  const { selectProfile, t } = useSettings()
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="account-menu" side="top" align={collapsed ? 'center' : 'start'} sideOffset={10} aria-label={t('账户菜单', 'Account menu')}>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={itemClass}>
              <Gift size={16} /><span>{t('高级版', 'Premium')}</span><small>{t('已使用 20%', '20% used')}</small><ChevronRight className="account-menu__chevron" size={14} />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="account-menu account-menu--sub" sideOffset={6}>
                <div className="account-plan"><strong>{t('高级版', 'Premium')}</strong><span>{t('已使用 20%', '20% used')}</span></div>
                <div className="account-plan__progress"><span /></div>
                <small className="account-plan__reset">{t('5 天后重置', 'Resets in 5 days')}</small>
                <DropdownMenu.Item className={itemClass} onSelect={() => onOpenSettings('billing')}>{t('管理用量', 'Manage usage')}</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item className={itemClass} onSelect={() => onNotify(t('移动端下载链接已复制（演示）', 'Mobile download link copied (demo)'))}><Smartphone size={16} />{t('获取 Morilo 移动版', 'Get Morilo for mobile')}</DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={itemClass}><CircleHelp size={16} />{t('支持', 'Support')}<ChevronRight className="account-menu__chevron" size={14} /></DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="account-menu account-menu--sub" sideOffset={6}>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify(t('帮助中心为演示入口', 'The Help Center is a demo entry'))}><CircleHelp size={15} />{t('帮助中心', 'Help Center')}</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify(t('快捷键：Enter 发送，Esc 关闭浮层', 'Shortcuts: Enter to send, Esc to close dialogs'))}>{t('快捷键', 'Keyboard shortcuts')}</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify(t('感谢反馈，演示反馈已记录', 'Thank you — demo feedback recorded'))}>{t('发送反馈', 'Send Feedback')}</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify(t('Morilo 演示 · 版本 0.78.1', 'Morilo Demo · Version 0.78.1'))}>{t('关于', 'About')}</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item className={itemClass} onSelect={() => onOpenSettings('general')}><Settings size={16} />{t('设置', 'Settings')}</DropdownMenu.Item>
          <DropdownMenu.Separator className="account-menu__separator" />
          <DropdownMenu.Item className={itemClass} onSelect={() => onOpenSettings('general')}><Plus size={16} />{t('添加本地资料', 'Add local profile')}</DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => void selectProfile('').catch((err) => onNotify(isCallError(err) ? err.message : t('退出失败', 'Could not sign out')))}><LogOut size={16} />{t('退出', 'Sign out')}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
