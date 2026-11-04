import type { Agent, Conversation, LibraryFile } from '@/types/chat'

export const agents: Agent[] = [
  {
    id: 'default', name: 'Morilo', color: 'white', role: '默认 Bot',
    description: 'Morilo 是内置的默认助手，进入应用后即可直接开始对话，无需创建或配置。',
    capabilities: ['日常问答与任务整理', '跨会话协作', '技能与应用连接'],
  },
  {
    id: 'xresearcher', name: 'XResearcher', color: 'blue', role: '深度调研与编程助手', variant: 1,
    description: '擅长跨资料调研、代码仓库分析和自动化任务。会把复杂问题拆成可验证的小步骤，并保留清晰的进度反馈。',
    capabilities: ['资料检索与交叉验证', 'GitHub 仓库与 PR 分析', '云端电脑和 CI 配置'],
  },
  {
    id: 'team', name: '我的 MacOS, CTO, fullstack', color: 'teal', role: '多 Agent 协作空间', variant: 4,
    description: '将系统管理、技术决策和全栈开发放在同一个会话里协作。', capabilities: ['多 Agent 讨论', '任务分派', '上下文共享'],
  },
  {
    id: 'product', name: '软件产品专家', color: 'orange', role: '产品策略顾问', variant: 2,
    description: '从个人开发者的真实约束出发，寻找可交付、可验证的产品机会。', capabilities: ['产品定位', '可行性分析', '路线图设计'],
  },
  {
    id: 'master', name: '不惑大师', color: 'green', role: '阅读与思考伙伴', variant: 3,
    description: '把复杂内容压缩成清晰、可执行的判断。', capabilities: ['长文精读', '观点提炼', '结构化笔记'],
  },
  {
    id: 'cto', name: 'CTO', color: 'green', role: '技术负责人', variant: 5,
    description: '关注架构、工程效率与长期维护成本，优先选择简单可靠的方案。', capabilities: ['架构评审', '技术选型', '项目记忆沉淀'],
  },
  {
    id: 'reader', name: 'reader', color: 'orange', role: '收藏内容导读', variant: 6,
    description: '阅读收藏内容并生成有观点的导读。', capabilities: ['网页阅读', '观点摘要', '主题归档'],
  },
  {
    id: 'journal', name: '日记本', color: 'gray', role: '定期回顾助手', variant: 7,
    description: '定期整理记录，生成轻松、有连续性的个人回顾。', capabilities: ['日记整理', '定期提醒', '每周回顾'],
  },
  {
    id: 'morilo', name: '探索 Morilo', color: 'purple', role: '自动化实验', variant: 8,
    description: '探索 Routine、技能和本地自动化的更多可能。', capabilities: ['Routine 设计', '技能实验', '流程自动化'],
  },
  {
    id: 'macos', name: '我的 MacOS', color: 'yellow', role: '本机管家', variant: 9,
    description: '管理本机环境、常用工具和个性化配置。', capabilities: ['环境检查', '工具配置', '本机自动化'],
  },
  {
    id: 'bookmarks', name: 'X 收藏导读', color: 'gray', role: '收藏内容整理', variant: 10,
    description: '把积压收藏转成值得阅读的专题导读。', capabilities: ['收藏归类', '主题导读', '阅读清单'],
  },
  {
    id: 'todo', name: 'TODO killer', color: 'gray', role: '待办清单助手', variant: 11,
    description: '把对话里的行动项放进清单，逐项推进。', capabilities: ['待办提取', '优先级排序', '完成回顾'],
  },
  {
    id: 'media', name: '自媒体助手', color: 'purple', role: '跨平台内容创作', variant: 12,
    description: '将同一份素材适配到不同内容平台。', capabilities: ['选题策划', '内容改写', '发布清单'],
  },
  {
    id: 'fullstack', name: 'fullstack', color: 'teal', role: '全栈开发伙伴', variant: 13,
    description: '从界面到 API，快速构建可运行的产品原型。', capabilities: ['前端开发', 'API 设计', '部署排错'],
  },
  {
    id: 'finance', name: '金融大师', color: 'teal', role: '金融研究助手', variant: 14,
    description: '按清晰顺序阅读财报与金融资料。', capabilities: ['财报精读', '指标对比', '研究框架'],
  },
]

const xMessages: Conversation['messages'] = [
  {
    id: 'x1', sender: 'agent',
    text: '两个仓库可以共用代码。routines、history、search 三个扩展两边完全一样，审批模块也只差几十行。我建议把这几块，连同新增的记忆、技能、防死循环这些，抽成一个共享包，两边各自组装，这样每个功能只要写一遍。\n\n反过来，tars 也有东西值得搬到 pi-cloud-agents。比如桌面扩展加无障碍树的实现，还有断线重连的机制，以及 viewer-proxy，可以拿来做预览链接。',
  },
  { id: 'x2', sender: 'user', text: '这俩仓库本来就是一个仓库分化出来的，你帮我记住这点～', quote: '两个仓库可以共用代码。routines、histor…' },
  { id: 'x3', sender: 'agent', text: '记住了，难怪那几个模块一模一样。以后给建议时，我都会把它们当成同一个仓库分出来的兄弟项目，优先考虑两边能不能共用一个包。' },
  { id: 'x4', sender: 'event', text: 'Today 11:16 PM' },
  {
    id: 'x5', sender: 'user',
    text: '我记得有人发帖过，Instabox 可以用来当作 GitHub Action 的机器。我有几台 Instabox，也有它的 API key，你可以帮我找一下对应的帖子，教会我如何配置吗？\n\n另外，你看一下我这个 PR 上面有太多的 Action 报错了，我想解决这些问题。',
  },
  { id: 'x6', sender: 'event', text: '查找论坛帖子与分析 PR', taskTitle: '查找论坛帖子与分析 PR' },
  {
    id: 'x7', sender: 'agent',
    text: 'Instabox 这边已经准备好了，就差在 GitHub 上注册。我选的是你那台 github-runner（Debian、x86_64、4 核 8G，Docker 和 Node 22 都装好了），runner 2.338.2 也已经下载、测试过了。\n\n唤醒我实测过：调一次 start 接口，机器 1 到 13 秒就能起来。每次跑 CI 前都调一下是安全的。workflow 里改成先调 start、等机器起来再开始跑任务。',
  },
  { id: 'x8', sender: 'user', text: '已经验证了', quote: 'Instabox 这边已经准备好了，就差在 GitH…' },
  { id: 'x9', sender: 'agent', text: '授权生效了，我已经能用 hifizz 的身份操作 GitHub 了。现在先给 thread-chatbot 配好 Secret 和变量，注册 runner。' },
  { id: 'x10', sender: 'user', text: '那算了，不要搞这么复杂，就给我的 thread-chatbot 这个项目添加就好了。' },
  {
    id: 'x11', sender: 'agent',
    text: 'thread-chatbot 的 runner 已经上线了，名字叫 instabox-thread-chatbot，状态显示 online，标签是 self-hosted、Linux、X64、instabox。Secret 和变量都配好了，runner 装成了开机自启的系统服务。\n\n我已经开了一个云端编程助手来改 workflow：加一个唤醒 Instabox 的小 job，再把主要任务改到 Instabox 上跑。改完会开 PR 给你看，不会自动合并。',
    code: 'runner: instabox-thread-chatbot\nstatus: online\nlabels: [self-hosted, Linux, X64, instabox]',
  },
]

const ctoMessages: Conversation['messages'] = [
  { id: 'c1', sender: 'user', text: '我不在乎完美的解决方案，我在乎的是用最小的代价去解决我的问题和需求。' },
  { id: 'c2', sender: 'agent', text: '好问题，这其实是“给 Agent 建一层可沉淀、可过期、可同步的项目记忆”。我按从便宜到复杂的顺序给你理一下。' },
  { id: 'c3', sender: 'agent', text: '先分清两类知识，它们住的地方不一样\n\n• 项目经验：只对这个仓库有意义，跟着代码走，放在仓库里，比如 docs/lessons/2026-10-26-fly-deploy.md。\n• 调研结论：跨项目复用，不该绑在某个仓库，放进一个独立的知识仓库。\n\n然后关键一步：在 AGENTS.md 里写一条规则。Agent 不会主动翻文件，索引和规则才是让知识被用上的开关，文件本身只是存储。' },
  { id: 'c4', sender: 'agent', text: '日常怎么沉淀：做两个命令就够了\n\n/retro：任务收尾时跑，让 Agent 回顾本次会话，写一份经验文档。\n/research <主题>：调研结束时跑，固定输出结论、资料来源、关键事实和未解决的问题。\n\n原则是只记“下次会改变决策的东西”，不记流水账。' },
]

const macMessages: Conversation['messages'] = [
  { id: 'm1', sender: 'agent', text: '配置是对的，执行已经设成 Always allow，Mac 也显示在线。我再连一次试试。' },
  { id: 'm2', sender: 'agent', text: '连上了，刚刚在你的 Mac 上成功跑了一条命令：Apple 芯片、macOS 26.6.2、用户 zilin。之前那次只是桌面版刚上线还没连稳。现在可以直接在你本机干活了。' },
  { id: 'm3', sender: 'user', text: '先看我本地安装的 Codex、Claude Code、Devin CLI、Pi agent 和 Kiro CLI，整理一份可以反复用的使用说明。' },
  { id: 'm4', sender: 'agent', text: '明白，我先逐个查它们的非交互调用、指定模型和努力程度、限定工具或 MCP、以及接着上次对话继续的方法，再用很小的任务实测一遍。整理好后做成一份使用说明 skill。' },
]

function simpleConversation(agentId: string, title: string, preview: string, text: string): Conversation {
  return {
    id: agentId, agentId, title, preview, time: '昨天',
    messages: [
      { id: `${agentId}-1`, sender: 'user', text: preview },
      { id: `${agentId}-2`, sender: 'agent', text },
    ],
    tasks: [{ id: `${agentId}-task`, title: '整理本次对话结论', status: 'finished', detail: '已将关键结论整理为可复用的说明。' }],
  }
}

export const initialConversations: Conversation[] = [
  {
    id: 'default', agentId: 'default', title: 'Morilo', preview: '默认 Bot 已准备好', time: '现在',
    messages: [
      { id: 'default-welcome', sender: 'agent', text: '你好，我是 Morilo。这个默认会话已经为你准备好了，无需创建 Bot，直接告诉我你想做什么。' },
    ],
    tasks: [],
  },
  {
    id: 'xresearcher', agentId: 'xresearcher', title: 'XResearcher', preview: 'Cursor agent: CI 改到 Instab…', time: '现在', messages: xMessages,
    tasks: [
      { id: 'task-ci', title: 'CI 改到 Instabox 自托管 runner', status: 'running', detail: '正在添加唤醒机器的小 job，并调整主 workflow 的运行环境。' },
      { id: 'task-pr', title: '修复 PR #175 的 CI 报错', status: 'finished', detail: '已修复依赖缓存与 Node 版本不一致的问题。' },
    ],
  },
  {
    id: 'team', agentId: 'team', title: '我的 MacOS, CTO, fullsta…', preview: '更正一下我刚才的话：既然你…', time: '23:48',
    messages: [
      { id: 'team-1', sender: 'event', text: '我的 MacOS、CTO、fullstack、TODO killer 和软件产品专家' },
      { id: 'team-2', sender: 'agent', text: '更正一下我刚才的话：既然你更在意最小成本，我们就不单独做一套复杂系统。先由 CTO 给出决策，fullstack 负责实现，MacOS 只处理本机验证。' },
      { id: 'team-3', sender: 'user', text: '可以，先给一个能跑的版本，不要过度设计。' },
      { id: 'team-4', sender: 'agent', text: '收到。第一版只保留会话、任务和本机状态三个视图，数据先用演示内容，界面组件保持独立，后面再接真实能力。' },
    ],
    tasks: [{ id: 'team-task', title: '协调多 Agent 工作区', status: 'running', detail: '三位 Agent 已加入当前协作空间。' }], tag: '4 人协作',
  },
  simpleConversation('product', '软件产品专家', '机会，按个人开发者的可行性…', '我会先按个人开发者的可行性筛选：分发路径是否现成、是否能在一周内验证、是否依赖重资产。最后只保留三个值得动手的机会。'),
  simpleConversation('master', '不惑大师', 'Sent 1 Markdown file', '这份材料的核心不是“知道更多”，而是减少不必要的选择。我整理了一页精读笔记，保留了原文里真正能改变行动的三个判断。'),
  { id: 'cto', agentId: 'cto', title: 'CTO', preview: '要我把 /retro、/research 模…', time: '22:16', messages: ctoMessages, tasks: [{ id: 'cto-task', title: '设计项目记忆沉淀方式', status: 'finished', detail: '已确定使用项目经验文档与全局调研库两层结构。' }] },
  simpleConversation('reader', 'reader', '原话是：“Hot take: if your C…', '这篇帖子的价值在于反常识，但结论需要加边界。我把原话、上下文和我自己的判断分开整理，避免把情绪当成论据。'),
  simpleConversation('journal', '日记本', '都设好了。每周日晚上 9 点左…', '都设好了。每周日晚上 9 点左右，我会把这周的记录整理成一份简短回顾，只保留情绪变化、重要事件和下周想继续的事。'),
  simpleConversation('morilo', '探索 Morilo', '你可以把 routine 理解成一条…', '你可以把 routine 理解成一条带触发条件的工作流：什么时候跑、要看什么、发生变化时才通知你。先从每天一次的轻量任务开始。'),
  { id: 'macos', agentId: 'macos', title: '我的 MacOS', preview: '记住了。memos 的入口在你…', time: '20:05', messages: macMessages, tasks: [{ id: 'mac-task', title: '调研本地命令行工具', status: 'running', detail: '正在检查五个命令行工具的非交互调用方式。' }], tag: '帮我打理好我的 Mac' },
  simpleConversation('bookmarks', 'X 收藏导读', '第一份导读发完了，积压的 20…', '第一份导读发完了。积压的收藏已经按 AI 工具、产品设计和工程实践分成三组，下一篇会先读 AI 工具这一组。'),
  simpleConversation('todo', 'TODO killer', '已加到 Zilin 的待办清单 第 5…', '已加到 Zilin 的待办清单第 5 项。我把任务拆成了两个可勾选项，完成后会自动归档到今天的记录里。'),
  simpleConversation('media', '自媒体助手', 'X、公众号、小红书三个平台一…', '同一主题我会保留核心观点，但分别调整开头、长度和语气：X 更直接，公众号保留完整论证，小红书先给使用场景。'),
  simpleConversation('fullstack', 'fullstack', '一句话：NeonLingo 是 Chro…', '我建议先做一个垂直切片：首页录入、生成结果、保存记录。确认这条路径跑通之后，再补登录和更多设置，避免一开始就铺得太大。'),
  simpleConversation('finance', '金融大师', '建议按这个顺序精读：', '建议按这个顺序精读：先看业务与现金流，再看利润表，最后核对资产负债和附注。这样不容易被单一指标带偏。'),
]

export const libraryFiles: LibraryFile[] = [
  { id: 'f1', name: 'Instabox Runner 配置.md', type: 'Markdown', updated: '刚刚更新', content: '# Instabox Runner 配置\n\n已完成机器唤醒、runner 注册与 workflow 调整。\n\n- 机器：github-runner\n- 系统：Debian / x86_64\n- Runner：instabox-thread-chatbot\n- 状态：online' },
  { id: 'f2', name: 'PR 175 CI 排查.md', type: 'Markdown', updated: '今天 22:41', content: '# PR 175 CI 排查\n\n主要问题来自 Node 版本和依赖缓存。已在 workflow 中统一 Node 版本，并保留安装日志便于后续排查。' },
  { id: 'f3', name: 'workflow.yml', type: 'Code', updated: '今天 22:36', content: 'jobs:\n  wake-runner:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Wake Instabox\n        run: echo "Starting runner…"\n  test:\n    needs: wake-runner\n    runs-on: [self-hosted, instabox]' },
]
