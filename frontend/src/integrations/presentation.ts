type Translate = (zh: string, en: string) => string

export function integrationCategoryLabel(category: string, t: Translate) {
  const labels: Record<string, string> = {
    All: '全部', 'Password Managers': '密码管理', Productivity: '效率', Communication: '沟通',
    Design: '设计', Code: '代码', Data: '数据', Sales: '销售', Marketing: '营销', Finance: '财务',
    Research: '研究', Support: '支持', 'Team plugins': '团队插件', 'Recommended for you': '可用的只读连接',
  }
  return t(labels[category] ?? category, category === 'Recommended for you' ? 'Available read-only connections' : category)
}

export function integrationStatusLabel(status: string, t: Translate) {
  const labels: Record<string, [string, string]> = {
    ACTIVE: ['已连接', 'Connected'], INITIATED: ['等待授权', 'Awaiting authorization'],
    INITIALIZING: ['正在初始化', 'Initializing'], PENDING: ['等待授权', 'Awaiting authorization'],
    INACTIVE: ['未连接', 'Not connected'], EXPIRED: ['已过期', 'Expired'],
    FAILED: ['授权失败', 'Authorization failed'], DISABLED: ['已停用', 'Disabled'],
    REVOKED: ['已撤销', 'Revoked'], DISCONNECTED: ['已断开', 'Disconnected'],
  }
  const label = labels[status]
  return label ? t(...label) : t(`未就绪（${status}）`, `Not ready (${status})`)
}

export function integrationCapabilityLabel(slug: string, t: Translate) {
  const labels: Record<string, [string, string]> = {
    GITHUB_GET_THE_AUTHENTICATED_USER: ['读取当前账户资料', 'Read the authenticated profile'],
    GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: ['列出已授权可见的仓库', 'List accessible repositories'],
    GITHUB_GET_A_REPOSITORY: ['读取仓库详情', 'Read repository details'],
    GITHUB_LIST_REPOSITORY_ISSUES: ['读取仓库议题', 'Read repository issues'],
    VERCEL_GET_PROJECTS: ['读取项目（不包含环境变量）', 'Read projects (without environment variables)'],
    VERCEL_GET_DEPLOYMENTS: ['读取部署列表', 'Read deployments'],
  }
  const label = labels[slug]
  return label ? t(...label) : slug
}
