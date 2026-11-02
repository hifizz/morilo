import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronRight, CircleHelp, Gift, LogOut, Plus, Settings, Smartphone } from 'lucide-react'
import type { ReactNode } from 'react'

interface AccountMenuProps {
  children: ReactNode
  collapsed?: boolean
  onOpenSettings: (section: 'general' | 'billing') => void
  onNotify: (message: string) => void
}

const itemClass = 'account-menu__item'

export function AccountMenu({ children, collapsed, onOpenSettings, onNotify }: AccountMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="account-menu" side="top" align={collapsed ? 'center' : 'start'} sideOffset={10} aria-label="账户菜单">
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={itemClass}>
              <Gift size={16} /><span>Premium</span><small>20% used</small><ChevronRight className="account-menu__chevron" size={14} />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="account-menu account-menu--sub" sideOffset={6}>
                <div className="account-plan"><strong>Premium</strong><span>20% used</span></div>
                <div className="account-plan__progress"><span /></div>
                <small className="account-plan__reset">Resets in 5 days</small>
                <DropdownMenu.Item className={itemClass} onSelect={() => onOpenSettings('billing')}>Manage usage</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item className={itemClass} onSelect={() => onNotify('移动端下载链接已复制（演示）')}><Smartphone size={16} />Get Grok Bot for mobile</DropdownMenu.Item>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className={itemClass}><CircleHelp size={16} />Support<ChevronRight className="account-menu__chevron" size={14} /></DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent className="account-menu account-menu--sub" sideOffset={6}>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify('帮助中心为演示入口')}><CircleHelp size={15} />Help Center</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify('快捷键：Enter 发送，Esc 关闭浮层')}>Keyboard shortcuts</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify('感谢反馈，演示反馈已记录')}>Send Feedback</DropdownMenu.Item>
                <DropdownMenu.Item className={itemClass} onSelect={() => onNotify('Grok Bot Demo · Version 0.78.1')}>About</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
          <DropdownMenu.Item className={itemClass} onSelect={() => onOpenSettings('general')}><Settings size={16} />Settings</DropdownMenu.Item>
          <DropdownMenu.Separator className="account-menu__separator" />
          <DropdownMenu.Item className={itemClass} onSelect={() => onNotify('演示版暂不支持添加真实账户')}><Plus size={16} />Add account</DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => onNotify('演示账号保持登录状态')}><LogOut size={16} />Log out</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
