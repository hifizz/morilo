import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Button, Menu } from '@/design-system'
import { integrationApps, moreCategories, primaryCategories } from './data'
import { IntegrationAppRow } from './IntegrationAppRow'
import { IntegrationIcon } from './IntegrationIcon'
import type { IntegrationApp, IntegrationCategory } from './types'

type Category = 'All' | IntegrationCategory

interface AppDirectoryProps {
  connectedIds: string[]
  onOpenManage: () => void
  onOpenApp: (id: string) => void
  onNotify: (message: string) => void
}

export function AppDirectory({ connectedIds, onOpenManage, onOpenApp, onNotify }: AppDirectoryProps) {
  const [category, setCategory] = useState<Category>('All')
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const connectedApps = connectedIds
    .map((id) => integrationApps.find((app) => app.id === id))
    .filter((app): app is IntegrationApp => Boolean(app))

  const searchResults = useMemo(() => {
    if (!normalizedQuery) return []
    return integrationApps.filter((app) => (
      app.name.toLowerCase().includes(normalizedQuery)
      || app.description.toLowerCase().includes(normalizedQuery)
      || app.skills.some((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(normalizedQuery))
    )).slice(0, 8)
  }, [normalizedQuery])

  const sections = useMemo(() => {
    if (category !== 'All') {
      return [{ title: category, apps: integrationApps.filter((app) => app.category === category), preview: false }]
    }
    const result = [{
      title: 'Recommended for you',
      apps: integrationApps.filter((app) => app.recommended),
      preview: true,
    }]
    const categories: IntegrationCategory[] = [
      'Password Managers', 'Productivity', 'Communication', 'Design', 'Code',
      'Data', 'Sales', 'Marketing', 'Finance', 'Research', 'Support', 'Team plugins',
    ]
    categories.forEach((title) => {
      const apps = integrationApps.filter((app) => app.category === title)
      if (apps.length > 0) result.push({ title, apps, preview: true })
    })
    return result
  }, [category])

  const openApp = (id: string) => {
    setQuery('')
    onOpenApp(id)
  }

  return (
    <div className="integration-directory">
      <div className="integration-directory__top">
        <h2>Connect Apps</h2>
        <button type="button" className="integration-manage-entry" onClick={onOpenManage}>
          <span className="integration-connected-stack" aria-hidden="true">
            {connectedApps.slice(0, 4).map((app) => <IntegrationIcon key={app.id} icon={app.icon} size={21} />)}
          </span>
          <span>{connectedIds.length} connected</span>
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="integration-directory__tools">
        <div className={`integration-search ${normalizedQuery ? 'has-query' : ''}`}>
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search across apps and skills"
            aria-label="Search across apps and skills"
          />
          {query && <button type="button" className="integration-search__clear" onClick={() => setQuery('')}>Clear</button>}
        </div>
        <Button variant="secondary" className="integration-template-button" onClick={() => onNotify('Bot templates 将在新窗口打开（演示）')}>
          <span className="integration-template-mark" aria-hidden="true">◕</span>
          Bot templates
          <ArrowUpRight size={14} />
        </Button>
      </div>

      {normalizedQuery ? (
        <div className="integration-search-results" role="listbox" aria-label="应用搜索结果">
          <span className="integration-search-results__label">Plugins</span>
          {searchResults.map((app, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === 0}
              className="integration-search-result"
              key={app.id}
              onClick={() => openApp(app.id)}
            >
              <IntegrationIcon icon={app.icon} size={28} />
              <span>{app.name}</span>
              <ChevronRight size={15} />
            </button>
          ))}
          {searchResults.length === 0 && (
            <div className="integration-empty">
              <strong>No apps or skills found</strong>
              <span>Try a different name or keyword.</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="integration-categories" aria-label="应用分类">
            {primaryCategories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? 'is-active' : ''}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
            <Menu
              label="更多应用分类"
              align="end"
              trigger={(
                <button type="button" className={moreCategories.includes(category as IntegrationCategory) ? 'is-active' : ''}>
                  {moreCategories.includes(category as IntegrationCategory) ? category : 'More'}
                  <ChevronDown size={13} />
                </button>
              )}
              items={moreCategories.map((item) => ({ id: item, label: item, onSelect: () => setCategory(item) }))}
            />
          </div>

          <div className="integration-scroll integration-directory__scroll">
            {sections.map((section) => (
              <section className="integration-section" key={section.title}>
                <div className="integration-section__heading">
                  <h3>{section.title}</h3>
                  {section.preview && section.title !== 'Recommended for you' && section.apps.length > 2 && (
                    <button type="button" onClick={() => setCategory(section.title as IntegrationCategory)}>View all</button>
                  )}
                </div>
                <div className="integration-app-grid">
                  {(section.preview ? section.apps.slice(0, section.title === 'Recommended for you' ? 6 : 4) : section.apps).map((app) => (
                    <IntegrationAppRow key={app.id} app={app} connected={connectedIds.includes(app.id)} onOpen={() => openApp(app.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
