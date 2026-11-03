import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { Menu } from '@/design-system'
import { useSettings } from '@/settings/SettingsProvider'
import { integrationApps, moreCategories, primaryCategories } from './data'
import { IntegrationAppRow } from './IntegrationAppRow'
import { IntegrationIcon } from './IntegrationIcon'
import { IntegrationFeedback, IntegrationSetup } from './IntegrationSetup'
import { integrationCategoryLabel } from './presentation'
import type { IntegrationApp, IntegrationCategory, IntegrationStore } from './types'

type Category = 'All' | IntegrationCategory

interface AppDirectoryProps {
  store: IntegrationStore
  onOpenManage: () => void
  onOpenApp: (id: string) => void
}

export function AppDirectory({ store, onOpenManage, onOpenApp }: AppDirectoryProps) {
  const { snapshot, t } = useSettings()
  const connectedIds = store.connectedIds
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
      apps: integrationApps.filter((app) => app.available),
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
        <h2>{t('连接应用', 'Connect Apps')}</h2>
        <button type="button" className="integration-manage-entry" onClick={onOpenManage}>
          <span className="integration-connected-stack" aria-hidden="true">
            {connectedApps.slice(0, 4).map((app) => <IntegrationIcon key={app.id} icon={app.icon} size={21} />)}
          </span>
          <span>{t(`${connectedIds.length} 个已连接`, `${connectedIds.length} connected`)}</span>
          <ChevronRight size={15} />
        </button>
      </div>

      <IntegrationSetup store={store} />
      <IntegrationFeedback store={store} />

      <div className="integration-directory__tools">
        <div className={`integration-search ${normalizedQuery ? 'has-query' : ''}`}>
          <Search size={17} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            spellCheck={snapshot?.preferences.spellcheck ?? true}
            placeholder={t('搜索应用', 'Search apps')}
            aria-label={t('搜索应用', 'Search apps')}
          />
          {query && <button type="button" className="integration-search__clear" onClick={() => setQuery('')}>{t('清除', 'Clear')}</button>}
        </div>
      </div>

      {normalizedQuery ? (
        <div className="integration-search-results" role="listbox" aria-label={t('应用搜索结果', 'App search results')}>
          <span className="integration-search-results__label">{t('应用', 'Apps')}</span>
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
              {!app.available && <span className="integration-coming-soon">{t('尚未接入', 'Coming soon')}</span>}
              <ChevronRight size={15} />
            </button>
          ))}
          {searchResults.length === 0 && (
            <div className="integration-empty">
              <strong>{t('未找到应用', 'No apps found')}</strong>
              <span>{t('请尝试其他名称或关键词。', 'Try a different name or keyword.')}</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="integration-categories" aria-label={t('应用分类', 'App categories')}>
            {primaryCategories.map((item) => (
              <button
                type="button"
                key={item}
                className={category === item ? 'is-active' : ''}
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
              >
                {integrationCategoryLabel(item, t)}
              </button>
            ))}
            <Menu
              label={t('更多应用分类', 'More app categories')}
              align="end"
              trigger={(
                <button type="button" className={moreCategories.includes(category as IntegrationCategory) ? 'is-active' : ''}>
                  {moreCategories.includes(category as IntegrationCategory) ? integrationCategoryLabel(category, t) : t('更多', 'More')}
                  <ChevronDown size={13} />
                </button>
              )}
              items={moreCategories.map((item) => ({ id: item, label: integrationCategoryLabel(item, t), onSelect: () => setCategory(item) }))}
            />
          </div>

          <div className="integration-scroll integration-directory__scroll">
            {sections.map((section) => (
              <section className="integration-section" key={section.title}>
                <div className="integration-section__heading">
                  <h3>{integrationCategoryLabel(section.title, t)}</h3>
                  {section.preview && section.title !== 'Recommended for you' && section.apps.length > 2 && (
                    <button type="button" onClick={() => setCategory(section.title as IntegrationCategory)}>{t('查看全部', 'View all')}</button>
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
