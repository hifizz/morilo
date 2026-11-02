import { useState } from 'react'
import { Laptop, MoreHorizontal, Smartphone } from 'lucide-react'
import { Button, IconButton, Menu, Select, Switch } from '@/design-system'
import { SettingCard, SettingRow, SettingSectionLabel } from './SettingControls'
import type { SettingsPageProps } from './types'

const initialDevices = [
  { id: 'mac', name: 'MacBookPro.lan', meta: 'Computer · Online now', online: true, type: 'computer' },
  { id: 'server', name: '4.201.169.192.host.secureserver.net', meta: 'Computer · Online now', online: true, type: 'computer' },
  { id: 'phone', name: 'iPhone 15 Pro Max', meta: 'iOS · Last opened 25 minutes ago', online: false, type: 'phone' },
  { id: 'ipad', name: 'iPad17,1', meta: 'iOS · Last opened 17 hours ago', online: false, type: 'phone' },
]

export function ComputerSettings({ onNotify }: SettingsPageProps) {
  const [execution, setExecution] = useState('always')
  const [routeTraffic, setRouteTraffic] = useState(false)
  const [devices, setDevices] = useState(initialDevices)
  const [pending, setPending] = useState<'update' | 'reset' | null>(null)

  const runComputerAction = (action: 'update' | 'reset') => {
    setPending(action)
    window.setTimeout(() => {
      setPending(null)
      onNotify(action === 'update' ? "Bot's Computer 已更新（演示）" : "Bot's Computer 已重置（演示）")
    }, 900)
  }

  return (
    <div className="settings-scroll">
      <SettingSectionLabel>Your computer</SettingSectionLabel>
      <SettingCard>
        <SettingRow title="Execution on this computer" description="Let Grok Bot open files and run tasks on your computer. Auto-review still checks everything first.">
          <Select label="本机执行权限" value={execution} onValueChange={setExecution} options={[{ value: 'always', label: 'Always allow' }, { value: 'ask', label: 'Ask every time' }, { value: 'never', label: 'Never allow' }]} />
        </SettingRow>
        <SettingRow title="Route traffic through this computer" description="Route network traffic from Grok Bot's computer through your local desktop computer instead of the cloud. Applies to new connections."><Switch label="通过本机路由流量" checked={routeTraffic} onCheckedChange={setRouteTraffic} /></SettingRow>
      </SettingCard>

      <SettingSectionLabel>Manage devices</SettingSectionLabel>
      <SettingCard className="device-list">
        {devices.map((device, index) => (
          <div className="device-row" key={device.id}>
            {device.type === 'computer' ? <Laptop size={18} /> : <Smartphone size={18} />}
            <div><strong>{device.name}</strong><span className={device.online ? 'is-online' : ''}>{device.meta}</span></div>
            {index === 1 && <Select label="设备执行权限" value={execution} onValueChange={setExecution} options={[{ value: 'always', label: 'Always allow' }, { value: 'ask', label: 'Ask every time' }, { value: 'never', label: 'Never allow' }]} />}
            {!device.online ? (
              <Button variant="ghost" size="sm" onClick={() => { setDevices((items) => items.filter((item) => item.id !== device.id)); onNotify(`已移除 ${device.name}`) }}>Remove</Button>
            ) : index === 1 ? (
              <Menu label="设备操作" align="end" trigger={<IconButton label="设备更多操作"><MoreHorizontal size={17} /></IconButton>} items={[{ id: 'status', label: 'Online now', onSelect: () => onNotify('设备当前在线，保持连接') }]} />
            ) : null}
          </div>
        ))}
      </SettingCard>

      <SettingSectionLabel>Bot's computer</SettingSectionLabel>
      <SettingCard>
        <SettingRow title="Update Bot's Computer" description="Updates the computer your Bots share. Your files and logins stay, but installed apps and packages are removed. All Bots update together."><Button variant="secondary" size="sm" loading={pending === 'update'} onClick={() => runComputerAction('update')}>Update</Button></SettingRow>
        <SettingRow title="Reset Bot's Computer" description="Start fresh if the computer gets stuck. It's rebuilt from your last saved snapshot, so very recent changes may be lost."><Button variant="danger" size="sm" loading={pending === 'reset'} onClick={() => runComputerAction('reset')}>Reset</Button></SettingRow>
      </SettingCard>
    </div>
  )
}
