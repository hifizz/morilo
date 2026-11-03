import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import App from './App.tsx'
import { DesignSystemShowcase } from './design-system/Showcase'
import { SettingsProvider } from './settings/SettingsProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TooltipProvider delayDuration={450} skipDelayDuration={150}>
        {new URLSearchParams(window.location.search).has('design-system') ? <DesignSystemShowcase /> : <SettingsProvider><App /></SettingsProvider>}
      </TooltipProvider>
    </BrowserRouter>
  </StrictMode>,
)
