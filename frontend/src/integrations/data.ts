import type { IntegrationApp, IntegrationCategory, IntegrationSkill, PrivateSkill } from './types'

export const primaryCategories: Array<'All' | IntegrationCategory> = [
  'All', 'Password Managers', 'Productivity', 'Communication', 'Design', 'Code',
]

export const moreCategories: IntegrationCategory[] = [
  'Data', 'Sales', 'Marketing', 'Finance', 'Research', 'Support',
]

const buildSkills = (
  owner: string,
  count: number,
  featured: Array<[string, string]> = [],
): IntegrationSkill[] => Array.from({ length: count }, (_, index) => {
  const item = featured[index]
  return {
    id: `${owner}-${item?.[0] ?? `workflow-${index + 1}`}`,
    name: item?.[0] ?? `${owner}-workflow-${index + 1}`,
    description: item?.[1] ?? `Guidance and reusable workflows for ${owner} integration ${index + 1}.`,
  }
})

const app = (
  id: string,
  name: string,
  category: IntegrationCategory,
  icon: string,
  description: string,
  skills: IntegrationSkill[] = [],
  recommended = false,
): IntegrationApp => ({
  id,
  name,
  category,
  icon,
  description,
  skills,
  recommended,
  developer: name,
  website: `${id.replace(/-team$/, '').replace(/[^a-z0-9]/g, '')}.com`,
  connectorName: id,
  team: category === 'Team plugins',
})

const vercelSkills = buildSkills('vercel', 33, [
  ['access-protected-vercel-deployment', 'Access and test Vercel deployments protected by Vercel Authentication, SSO, or Deployment Protection.'],
  ['ai-gateway', 'Vercel AI Gateway guidance for setup, model discovery, authentication, routing, fallbacks, virtual models, evaluation models, BYOK, and budgets.'],
  ['ai-sdk', 'Vercel AI SDK expert guidance. Use when building AI-powered features — chat interfaces, text generation, structured output, and tool calling.'],
  ['auth', 'Authentication integration guidance — Clerk, Better Auth, Descope, and Auth0 setup for Next.js applications.'],
  ['bootstrap', 'Project bootstrapping orchestrator for repos that depend on Vercel-linked resources, databases, auth, and managed integrations.'],
])

const cloudflareSkills = buildSkills('cloudflare', 16, [
  ['agents-sdk', 'Build, debug, or review Cloudflare Agents SDK applications using the agents package.'],
  ['basin', 'Build and troubleshoot Cloudflare Basin analytics workflows with Basin Pipelines, Basin Catalog, and Basin SQL.'],
  ['cloudflare', 'Discover and choose Cloudflare products for apps, APIs, AI agents, storage, networking, and security.'],
  ['cloudflare-email-service', 'Implement or troubleshoot Cloudflare Email Sending and Email Routing integrations and their delivery configuration.'],
  ['cloudflare-one', 'Design, configure, troubleshoot, or review Cloudflare One Zero Trust and SASE deployments.'],
])

const contextSkills = buildSkills('context-dev', 11, [
  ['context-search', 'Search technical documentation and return focused, current context for coding agents.'],
  ['library-research', 'Resolve libraries and research API usage with version-aware documentation.'],
])

export const integrationApps: IntegrationApp[] = [
  app('datadog', 'Datadog', 'Code', 'datadog', 'Monitor infrastructure, applications, and logs.', buildSkills('datadog', 4), true),
  { ...app('vercel', 'Vercel', 'Code', 'vercel', 'Build and deploy web apps and agents.', vercelSkills, true), website: 'vercel.com' },
  app('supabase', 'Supabase', 'Code', 'supabase', 'Build with a Postgres database, authentication, and storage.', buildSkills('supabase', 8), true),
  { ...app('cloudflare', 'Cloudflare', 'Code', 'cloudflare', 'Connect applications to Cloudflare infrastructure and developer tools.', cloudflareSkills, true), website: 'www.cloudflare.com' },
  app('sentry', 'Sentry', 'Code', 'sentry', 'Find and fix application errors with full-stack monitoring.', buildSkills('sentry', 3), true),
  app('firebase', 'Firebase', 'Code', 'firebase', 'Build and run applications with Firebase services.', buildSkills('firebase', 6), true),
  app('1password', '1Password', 'Password Managers', '1password', 'Securely access passwords and secrets.'),
  app('notion', 'Notion', 'Productivity', 'notion', 'Read and update pages, databases, and team knowledge.', buildSkills('notion', 5)),
  app('atlassian', 'Atlassian', 'Productivity', 'atlassian', 'Work with Jira issues and Confluence content.', buildSkills('atlassian', 4)),
  app('gmail', 'Gmail', 'Productivity', 'gmail', 'Read, organize, and draft email.'),
  app('outlook', 'Outlook', 'Productivity', 'outlook', 'Manage Outlook mail and calendar.'),
  app('linear', 'Linear', 'Productivity', 'linear', 'Create and manage issues, projects, and cycles.', buildSkills('linear', 2)),
  app('feishu', 'Feishu', 'Productivity', 'feishu', 'Collaborate with Feishu messages and documents.'),
  app('x', 'X', 'Research', 'x', 'Research posts, accounts, trends, and news on X.', buildSkills('x', 1)),
  app('slack', 'Slack', 'Communication', 'slack', 'Search conversations and send team messages.'),
  app('discord', 'Discord', 'Communication', 'discord', 'Read channels and collaborate with communities.'),
  app('telegram', 'Telegram', 'Communication', 'telegram', 'Send messages and manage Telegram workflows.'),
  app('zoom', 'Zoom', 'Communication', 'zoom', 'Access meetings, recordings, and transcripts.'),
  app('figma', 'Figma', 'Design', 'figma', 'Inspect designs, components, and design context.', buildSkills('figma', 3)),
  app('canva', 'Canva', 'Design', 'canva', 'Create and manage visual designs.'),
  app('framer', 'Framer', 'Design', 'framer', 'Build and publish responsive websites.'),
  app('webflow', 'Webflow', 'Design', 'webflow', 'Manage Webflow sites and CMS content.'),
  app('superpower', 'Superpower', 'Code', 'superpower', 'Give your agent focused developer superpowers.'),
  app('redis', 'Redis', 'Code', 'redis', 'Work with Redis data and caching workflows.', buildSkills('redis', 3)),
  app('azure', 'Azure', 'Code', 'azure', 'Build and operate applications on Microsoft Azure.', buildSkills('azure', 5)),
  app('aws-deployments', 'AWS Deployments', 'Code', 'aws', 'Deploy and operate workloads on AWS.', buildSkills('aws-deployments', 7)),
  app('aws-core', 'AWS Core', 'Code', 'aws', 'Use core AWS services with consistent guidance.', buildSkills('aws-core', 9)),
  app('mongodb', 'MongoDB', 'Code', 'mongodb', 'Query and manage MongoDB databases.', buildSkills('mongodb', 4)),
  app('twilio', 'Twilio', 'Code', 'twilio', 'Build messaging and communication workflows.'),
  app('compound', 'Compound Engineering', 'Code', 'compound', 'Plan and execute compound engineering workflows.', buildSkills('compound', 6)),
  app('airtable', 'Airtable', 'Data', 'airtable', 'Read and update structured Airtable data.'),
  app('snowflake', 'Snowflake', 'Data', 'snowflake', 'Query data and manage Snowflake resources.', buildSkills('snowflake', 3)),
  app('postgresql', 'PostgreSQL', 'Data', 'postgresql', 'Work safely with PostgreSQL databases.', buildSkills('postgresql', 4)),
  app('hubspot', 'HubSpot', 'Sales', 'hubspot', 'Manage CRM contacts, companies, and deals.'),
  app('salesforce', 'Salesforce', 'Sales', 'salesforce', 'Read and update Salesforce records.'),
  app('ahrefs', 'Ahrefs', 'Marketing', 'ahrefs', 'Research keywords, links, and search visibility.'),
  app('semrush', 'Semrush', 'Marketing', 'semrush', 'Run marketing and competitive research.'),
  app('mailchimp', 'Mailchimp', 'Marketing', 'mailchimp', 'Manage audiences and email campaigns.'),
  app('ramp', 'Ramp', 'Finance', 'ramp', 'Review expenses, cards, and financial workflows.'),
  app('phantom', 'Phantom', 'Finance', 'phantom', 'Connect wallet-related workflows.'),
  app('stripe', 'Stripe', 'Finance', 'stripe', 'Inspect payments, customers, and subscriptions.', buildSkills('stripe', 5)),
  app('parallel', 'Parallel', 'Research', 'parallel', 'Search and research the web with Parallel.', buildSkills('parallel', 2)),
  app('context-dev', 'Context.dev', 'Research', 'context-dev', 'Bring current technical context into your agent.', contextSkills),
  app('treg', 'Treg', 'Research', 'treg', 'Organize and review research sources.'),
  app('context7', 'Context7', 'Research', 'context7', 'Resolve up-to-date library documentation.', buildSkills('context7', 3)),
  app('intercom', 'Intercom', 'Support', 'intercom', 'Manage customer conversations and support context.'),
  app('plain', 'Plain', 'Support', 'plain', 'Work with customer support threads.'),
  app('cloudflare-team', 'cloudflare', 'Team plugins', 'cloudflare-team', 'Your team’s private Cloudflare plugin.', buildSkills('cloudflare-team', 2)),
  app('codex-team', 'codex', 'Team plugins', 'codex-team', 'Your team’s private Codex plugin.', buildSkills('codex-team', 2)),
  app('oz-harness-support', 'oz-harness-support', 'Team plugins', 'oz-harness', 'Private support workflows for your team.'),
]

export const initialInstalledIntegrationIds = [
  'gmail', 'outlook', 'x', 'linear', 'context-dev', 'feishu', 'parallel', 'notion', 'slack', 'figma',
]

export const initialConnectedIntegrationIds = [
  'gmail', 'x', 'context-dev', 'parallel', 'notion', 'slack', 'figma', 'stripe', 'discord', 'telegram',
]

export const initialPrivateSkills: PrivateSkill[] = [
  {
    id: 'getting-started',
    name: 'getting-started',
    description: 'Use on the first conversation with a new owner of the X research bot, to learn what they want researched on X and set up any watches.',
    instructions: `# Getting started (X research bot)\n\nI research X for my owner: posts, accounts, trends, and news, turned into summaries, reports, or ongoing watches.\n\nOpen with a short hello, then ask these one at a time, adapting to the answers and dropping the questions as soon as they hand over a real task:\n\n1. What do you want me to keep an eye on or dig into on X: specific topics or keywords, specific accounts, an industry, competitors, or general trends?\n2. How do you want results: a quick chat summary, a shareable report, or a recurring digest? If recurring, how often and at what time?`,
  },
  {
    id: 'local-agent-cli-subagents',
    name: 'local-agent-cli-subagents',
    description: '把本机安装的 AI 编码 CLI（Codex、Claude Code、Devin CLI、Pi、Kiro CLI）当作子代理以非交互方式调用，指定模型、努力程度、工具/技能/MCP/权限范围和输出格式，并跨多次调用续接同一会话。',
    instructions: `# 本机 AI 编码 CLI 子代理调用手册\n\n> 实测环境：一台 Apple Silicon Mac（macOS 26，zsh）。\n> 标记说明：**【已实测】** = 已用最小任务跑通并核对输出；**【仅文档】** = 来自 --help 或官方文档。\n> 模型名会随账号和版本变化，调用前先用每节里的“列模型”命令确认。\n\n## 0. 通用约定（所有工具都适用）\n\n- **一定要用登录 shell 跑**：这些 CLI 装在 ~/.local/bin、~/Library/pnpm/bin、~/.opencode/bin 等处。\n- 子代理任务必须给出清晰的输入、输出和权限边界。\n- 长任务要保存会话 ID，后续调用从同一会话继续。`,
  },
]
