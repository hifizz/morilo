import { useState } from 'react'
import { ArrowLeft, Check, Copy, Download, MoreHorizontal, Plus, Settings, Trash2 } from 'lucide-react'
import { Button, Dialog, Drawer, IconButton, Menu, SegmentedControl, TextArea, TextField } from './index'
import './showcase.css'

export function DesignSystemShowcase() {
  const [density, setDensity] = useState<'comfortable' | 'compact'>('compact')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [feedback, setFeedback] = useState('所有组件均使用同一组 Design Tokens')

  return (
    <main className="ds-showcase">
      <header className="ds-showcase__header">
        <a href="/" aria-label="返回应用"><ArrowLeft size={19} /></a>
        <div><p>GROK BOT / FOUNDATIONS</p><h1>Desktop Design System</h1></div>
        <span>v1.0</span>
      </header>
      <div className="ds-showcase__body">
        <section className="ds-specimen ds-specimen--intro">
          <div><p className="ds-specimen__eyebrow">PRINCIPLE 01</p><h2>Quiet surfaces.<br />Precise interactions.</h2></div>
          <p>层级来自克制的明度变化，而不是阴影和卡片堆叠。Radix 只负责交互行为，产品组件负责全部视觉表达。</p>
        </section>

        <section className="ds-specimen">
          <div className="ds-specimen__heading"><span>01</span><h2>Buttons</h2><p>Variants, sizes and pending states</p></div>
          <div className="ds-specimen__row">
            <Button onClick={() => setFeedback('主要操作已触发')}>Primary action</Button>
            <Button variant="secondary" onClick={() => setFeedback('次要操作已触发')}>Secondary</Button>
            <Button variant="ghost" onClick={() => setFeedback('Ghost 操作已触发')}>Ghost</Button>
            <Button variant="danger" onClick={() => setFeedback('危险操作已触发')}>Delete</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="ds-specimen__row ds-specimen__row--muted">
            <IconButton label="添加" onClick={() => setFeedback('添加按钮已触发')}><Plus size={18} /></IconButton>
            <IconButton label="复制" onClick={() => setFeedback('复制按钮已触发')}><Copy size={17} /></IconButton>
            <IconButton label="设置" active onClick={() => setFeedback('设置按钮已触发')}><Settings size={17} /></IconButton>
            <Menu label="示例菜单" trigger={<IconButton label="更多操作"><MoreHorizontal size={18} /></IconButton>} items={[
              { id: 'download', label: '导出记录', icon: <Download size={15} />, onSelect: () => setFeedback('菜单：导出记录') },
              { id: 'delete', label: '删除记录', icon: <Trash2 size={15} />, danger: true, onSelect: () => setFeedback('菜单：删除记录') },
            ]} />
          </div>
        </section>

        <section className="ds-specimen">
          <div className="ds-specimen__heading"><span>02</span><h2>Inputs & selection</h2><p>Consistent focus and density</p></div>
          <div className="ds-form-grid">
            <label>Agent name<TextField defaultValue="XResearcher" /></label>
            <label>Disabled field<TextField defaultValue="Read only" disabled /></label>
            <label className="ds-form-grid__wide">Instructions<TextArea defaultValue="保持回答简洁，优先给出可验证的步骤。" /></label>
          </div>
          <SegmentedControl value={density} onValueChange={setDensity} label="界面密度" options={[{ value: 'compact', label: 'Compact' }, { value: 'comfortable', label: 'Comfortable' }]} />
        </section>

        <section className="ds-specimen">
          <div className="ds-specimen__heading"><span>03</span><h2>Overlays</h2><p>Shared focus, keyboard and dismissal behavior</p></div>
          <div className="ds-specimen__row">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>Open dialog</Button>
            <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
          </div>
        </section>

        <section className="ds-specimen ds-token-section">
          <div className="ds-specimen__heading"><span>04</span><h2>Surface tokens</h2><p>Seven levels, one visual language</p></div>
          <div className="ds-token-grid">
            {['canvas', 'main', 'sidebar', 'subtle', 'default', 'raised', 'active'].map((name) => <div key={name} className={`ds-token ds-token--${name}`}><span>{name}</span><small>--ds-{name.includes('surface') ? name : `bg-${name}`}</small></div>)}
          </div>
        </section>
      </div>
      <footer className="ds-showcase__status"><Check size={15} /><span>{feedback}</span><small>Density: {density}</small></footer>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="统一弹窗" description="焦点锁定、Esc 关闭与遮罩关闭均由基础组件处理">
        <div className="ds-dialog-demo"><p>视觉样式来自产品 Tokens，而不是组件库默认主题。</p><Button onClick={() => { setDialogOpen(false); setFeedback('弹窗操作已确认') }}>完成</Button></div>
      </Dialog>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side="right" label="设计系统抽屉">
        <div className="ds-drawer-demo"><p>FOUNDATIONS</p><h2>Side panel</h2><span>与移动端 Agent 详情使用同一个 Drawer 基础组件。</span><Button onClick={() => setDrawerOpen(false)}>关闭抽屉</Button></div>
      </Drawer>
    </main>
  )
}
