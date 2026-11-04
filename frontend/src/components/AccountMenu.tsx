import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronRight, CircleHelp, LogOut, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { isCallError } from 'mygo-runtime'
import { useSettings } from '@/settings/SettingsProvider'
import type { SettingsSection } from '@/settings/types'

interface AccountMenuProps {
  children: ReactNode
  collapsed?: boolean
  onOpenSettings: (section: SettingsSection) => void
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
            <DropdownMenu.SubTrigger className={itemClass}><CircleHelp size={16} />{t('支持', 'Support')}<ChevronRight className="account-menu__chevron" size={14} /></DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="account-menu account-menu--sub" sideOffset={6}>
                <DropdownMenu.Item className={itemClass} onSelect={() => window.open('https://github.com/hifizz/morilo/issues', '_blank', 'noopener,noreferrer')}><CircleHelp size={15} />{t('问题反馈', 'Report an issue')}</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => window.open('https://github.com/hifizz/morilo#readme', '_blank', 'noopener,noreferrer')}>{t('使用文档', 'Documentation')}</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify(t('快捷键：Enter 发送，Esc 关闭浮层', 'Shortcuts: Enter to send, Esc to close dialogs'))}>{t('快捷键', 'Keyboard shortcuts')}</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onOpenSettings('updates')}>{t('关于', 'About')}</DropdownMenu.Item>
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
