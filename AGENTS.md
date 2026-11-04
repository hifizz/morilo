# Morilo

MyGo + React 的桌面 AI 工作伙伴：多 Bot、连续多条消息、思考状态展示。Agent 由 Pi（`pi --mode rpc`）驱动，走自家中转站。

## 结构与职责

```
morilo/
├── main.go              # MyGo 宿主：创建主窗口、绑定服务、selftest 入口
├── agent.go             # Chat 服务：每个会话一个 pi RPC 子进程；ChatEvent 流
├── computer.go          # Computer 服务：远程电脑 Status/Connect（绑给前端）
├── computer_bridge.go   # 回环工具桥：内嵌 extension.ts，Bearer token 鉴权
├── computer/            # computer.Backend 接口 + Instabox REST 适配器 + pi 扩展
├── store.go             # Store 服务：UI 状态（会话/Bot）JSON 落盘
├── agent_test.go        # Go↔Pi 真实 round-trip 测试
├── mygo.config.ts       # devUrl :3000、frontend/dist、bindings → frontend/src/mygo.ts
├── package.json         # dev / build / generate → mygo CLI
├── resources/icon.png   # 由 favicon.svg 转出的 1024² 图标
└── frontend/            # 原 React 项目（Vite + TS + shadcn + Tailwind）
    └── src/mygo.ts      # mygo generate 生成的类型化客户端（勿手改）
```

## 开发

```bash
export PATH="$HOME/.local/go/bin:$PATH"   # 已写入 ~/.zshrc
npm run dev        # = scripts/dev.sh：macOS 自动备好本地签名身份后 mygo dev -sign（详见 docs/development.md）；Vite :3000 + 构建并打开 Morilo Dev.app，改代码自动重载
npm run dev:setup  # = scripts/setup-dev-signing.sh：创建/复用专用开发 keychain（~/Library/Application Support/Morilo Development/，非登录钥匙串）里的 Morilo Local Development 证书并输出指纹（npm run dev 会自动调）
npm run build      # = mygo build：前端 tsc+vite → Go 编译内嵌 → .app + .dmg → build/darwin-arm64/
npm run generate   # 重新生成 frontend/src/mygo.ts
go test -v         # Go↔Pi round-trip（真实调模型，约 4-7s）
go test ./computer # Instabox 适配器：httptest 假 REST，无远程调用
go test . -run '^TestComputer|^TestPiEnv'  # 工具桥鉴权/分发/取消 + Status/Connect + pi 环境脱敏
```

## 界面改动的验收方式（必做）

改完界面类代码后，**必须自己截图验收**，不要只靠用户反馈：

```bash
MYGO_SELFTEST=1 npx mygo dev
# 等日志出现 "selftest done: /tmp/morilo-shot.png, agent bubbles: N"
```

selftest（main.go）会等页面加载后：向真实输入框注入 prompt → 回车发送 → 轮询 `.agent-status` 消失 → `win.CapturePage()` 截图存 `/tmp/morilo-shot.png` → 统计 `.message-row--agent` 气泡数。读这张图确认效果。

## 已完成功能（按时间序）

1. **MyGo 化改造**：React 项目原样迁入 `frontend/`；MyGo WebView 模式承载；`Morilo.app`+dmg 打包跑通。
2. **Chat 服务（Go↔Pi↔前端）**：`Chat.Send` 带 `*mygo.Channel[ChatEvent]`，channel 生命周期=一次 run；每会话一个 `pi --mode rpc` 子进程保上下文；`Chat.Stop`（abort）/`Chat.Reset`（杀进程）已就绪。
3. **流式渲染**：`text_delta` → agent 气泡；`thinking_delta`/`tool_execution_*` 只更新输入框上方「头像+一句进度」状态条（`.agent-status`，run 结束消失）——工具执行事件不再写入 UI 聊天记录，界面不展示工具名/参数/原始结果或原始推理；Pi 自身会话存储不变，Agent 正常回复中的代码保留。`error`/发送失败仍是 `sender:'event'` 持久事件行。历史 `taskTitle` 事件行在渲染与导出时过滤隐藏，日期等其它事件行保留。
4. **多消息气泡（连续短消息）**：两层机制——pi 的每个 assistant `message_start` 为一个气泡段（`ChatEvent.seg`）；`--append-system-prompt` 约定多条短消息用 `¶` 分隔，前端按 `¶` 实时切泡。已截图验收。
   - 每条 agent 消息的工具条（表情/引用/更多，`MessageToolbar`）显示在气泡**右侧**垂直居中而非下方：`.message-row--agent` 为 `flex-direction: row`，平时 `opacity:0`、hover 显示。已截图验收。
5. **会话持久化**：`Store`（load/save，600ms 防抖）写 `~/Library/Application Support/Morilo Dev/state.json`（发布构建为 `~/Library/Application Support/Morilo/state.json`）；pi 用 `--session-dir` + `--session-id <convId>`，重启续上下文。
6. **专属 LLM 配置（隔离）**：`PI_CODING_AGENT_DIR=<userData>/pi-agent`，与全局 `~/.pi/agent` 完全隔离：
   - `models.json` → provider `relay`（`https://relay.zilin.im/v1`，openai-completions），模型 `swe-2`（图文）
   - `settings.json` → 默认 provider/model
   - `auth.json` → `{"relay":{"type":"api_key","key":"!/usr/bin/security find-generic-password -s morilo-relay -w"}}` —— key 只在 macOS Keychain，不落文件
   - 缺文件时 `piAgentDir()` 自动写入默认配置
7. **selftest**：`MYGO_SELFTEST=1` 时自动走真实 UI 发消息+截图（见上）。
8. **无边框窗口**：`TitleBarStyle: TitleBarHiddenInset` + `TrafficLightPosition{15,17}`——原生红绿灯内嵌浮在页面上、与侧栏工具行垂直居中；页面用 `--app-region: drag` 标拖拽区（`.sidebar__actions`/`.chat-header`/`.agent-profile`，按钮自动 no-drag）；`--mygo-titlebar-inset-left` 变量给红绿灯让位；`.app-stage`/`.app-shell` 的假外壳（padding/边框/圆角/阴影）已拆，应用自身即窗口边界。已截图验收（红绿灯是原生控件不进 webview 截图）。
9. **远程电脑（共享 Instabox）**：设 `INSTABOX_API_KEY` + `INSTABOX_MACHINE_ID`（可选 `INSTABOX_API_URL`）即启用，缺任一保持本机模式。架构：`computer.Backend` 接口（Info/Wake/Exec/ReadFile/WriteFile/Screenshot/Act/DesktopURL）← `computer.Instabox` REST 适配；`Computer` 绑定服务只暴露 `Status`/`Connect(takeControl)`（默认 view-only 桌面 URL，可 opt-in 交互）；pi 侧不直连机器——`Computer.bridge()` 懒启 `127.0.0.1:0` HTTP 桥（随机 32B Bearer token、仅 POST、2MiB 上限），嵌入的 `computer/extension.ts` 写入 `piAgentDir()/computer-extension.ts` 注册 `computer_exec/read/write/desktop` 四工具经桥 fetch 回 Go。配好后 pi 起 `--no-builtin-tools --extension <path>` + 第二段 `--append-system-prompt`；`MORILO_*` 注入 pi 子进程环境，`INSTABOX_API_KEY` 永不下发。前端 `ComputerPanel`（Inspector Computer 页 + 设置 → Bot's computer，`label` 传 agent 名）：未配置显示 `INSTABOX_*` 说明；`Connect(takeControl)` 返回的签名 URL 进单个 iframe。默认 viewOnly 观看，Take control 才发 `viewOnly:false`（纯链接权限，非锁定/暂停 pi）。预览 16/10 自适应、输入禁用；常驻 `<dialog>` 里放 viewport/header/footer，展开时 `showModal()` 变全窗沉浸视图（Watch/Control pill、Minimize2 返回、Esc），iframe 节点不重建（仅切控制模式才换 URL）。右侧 `InspectorResizer`（左缘分隔条，280~`innerWidth-sidebar-320`，双击回 420，键盘可调）+ `.app-shell` 第三列 `clamp()`；浏览器预览固定「请在桌面应用中连接远程电脑」。桌面操作全走 argv+stdin（无 shell 插值），截图 `scrot` DISPLAY=:1。已验证：extension 在真实 pi 里加载并经桥调通 fake backend（computer_exec 事件+命令落账）；真机未测（无 key）。
10. **设置/本地资料（Settings）**：`Settings` 绑定服务持久化 `settings.json`（0600 原子写）：Preferences（theme/accent/language/spellcheck/microphoneId/timezone，枚举+IANA 校验）+ 多 `LocalProfile`（id/name/email/memory，仅本地无云登录）+ activeProfileId；`SelectProfile('')` = 退出到选择页不删数据。Store/Chat 按 profile 分域：首 profile 仍用旧 `state.json` 与旧 pi session id，其余走 `profiles/<id>/` 与 `profileID:convID`；每条消息经 `contextMessage` 注入时区/当前时间/`<imported_memory>`。记忆导入限 .txt/.md/.json、64KiB、JSON 格式化追加。前端 `SettingsProvider`（MyGo 走服务、浏览器走 localStorage `morilo-settings`，串行写入，`t(zh,en)` 行内翻译、matchMedia 主题 → `documentElement.dataset.theme` + `mygo.Theme.SetSource`）；`App` = 加载/出错边界 → 无 active profile 时 `LocalProfilePicker` → `ConversationApp key=profileID`；Store.save 带 profileID、卸载时 flush。General 设置通过服务持久化；硬件加速/安全密钥为禁用态说明文案；麦克风测试仅本地电平。前端 `useIntegrationStore(integrationsOpen)` 仅在打开集成面板时刷新连接状态（启动/聚焦不再自动请求，显式刷新与变更操作照常）。Composio 集成由 `Integrations` 服务 + `MORILO_APPS_*` 桥接（`Chat.integrations`，piEnv 会剥 `COMPOSIO_API_KEY`/`MORILO_APPS_*`）；Composio key 存 OS 凭据服务 `dev.morilo.app.integrations`/`composio-api-key`，不落文件；macOS 开发构建例外走稳定的 `/usr/bin/security` 客户端读/写（自签应用的分区 ACL 按 CDHash 变，生产仍用 mygo.Secrets，同一登录钥匙串 service/account，无明文落盘、诊断不导出密钥）；仅支持 GitHub/Vercel，开放六个只读白名单工具。`MYGO_SELFTEST=1` 现在用临时 userData 目录隔离，不碰真实用户数据。
11. **开发诊断**：仅开发构建且非 MYGO_SELFTEST 时启用 .mygo/diagnostics（目录 0700，文件 0600，不入 Git）。ready.json 提供 pid；request.json 为 {id,pid,action,appId?,slug?,arguments?}，response.json 按 id/pid 匹配返回 data/error。一次一个请求；支持 status/open-apps/screenshot/connect/tools/run，以及固定的 acceptance-start/acceptance-status，无任意 JS、shell 或密钥导出接口。status 只返回钥匙串是否存有密钥及当前资料的连接状态；连接及工具调用仍走 Integrations 的资料隔离、授权 URL 校验和只读工具白名单。acceptance-start 在当前真实资料中新建验收 Bot，通过真实输入框发送固定的六项只读查询；acceptance-status 观察实际 Chat 事件及渲染后的界面。生产构建无此入口。
12. **聊天展示**：普通回复不主动播报工具名、调用参数或日志，明确的 API/调试请求仍可展示技术细节。Agent 消息使用 react-markdown + remark-gfm，保留默认 URL 过滤、禁用原始 HTML，图片仅显示替代文字，外链在默认浏览器打开；用户原文和历史消息数据不改写。定向检查：`npm --prefix frontend run test:markdown`。

## 关键行为约定

- 圆角形状通过 `--ds-corner-shape: squircle` 与全局基础选择器统一设置，常规容器半径由 `--ds-radius-*` token 与 Tailwind 圆角映射统一控制；圆形控件保留 `50%`/round 半径。按用户选择仅使用原生 CSS：支持的浏览器显示 squircle，不支持的引擎保留普通圆角，不引入兼容库；本机 macOS 26.6 的 WKWebView 实测尚不支持。
- Composio hosted connect 链接仅有效 10 分钟。先准备好 Vercel Token，再生成并打开新链接；超时后重新生成链接，不要直接认定 Token 无效或要求重建。`EXPIRED` 也可能表示连接流程超时，是否可用须以 `ACTIVE` 和真实只读调用为准。
- 同一工作目录的多个 `mygo dev` 共用 `.mygo/dev` 构建产物，不要并行启动。selftest 的临时 userData 只隔离业务数据，不隔离构建目录；优先复用当前开发诊断入口，必须运行 selftest 时先协调现有实例或使用隔离工作目录。
- 真实聊天验收期间保持文件和运行实例稳定；页面重载会清空内存中的验收观察状态。遇到等待或钥匙串问题，先核对 ready.json 的当前 PID，不要用旧进程的调用栈推断当前实例仍在等待系统授权。
- pi 工具工作目录：`~/morilo-workspace`
- 输入框在 run 期间禁用；「清空当前会话」同时 `Chat.reset` 杀掉该会话 agent
- 纯浏览器打开 :3000（无 `window.mygo`）时走演示假回复，便于前端独立开发
- `¶` 是消息切泡分隔符：内容本身含 `¶` 会误切（已知边界，遇再收紧）
- 应用数据按应用名分目录：开发构建与发布构建的 userData 各自独立（`~/Library/Application Support/Morilo Dev/` 与 `~/Library/Application Support/Morilo/`）；更改应用名后需要一次性迁移既有本地数据与凭据，迁移以复制为主并保留原件，仅更新必要的配置引用和内置品牌标签，不得盲目替换用户消息内容

## 环境

- Go 1.27.3 → `~/.local/go`（需在 PATH）
- pi 1.5.0 → `~/.local/bin/pi`（本机全局安装，供子进程调用）
- Node 24 / npm；`mygo` CLI 走 node_modules/.bin（mygo-cli@0.7.4）
