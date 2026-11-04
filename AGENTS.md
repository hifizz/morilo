# Morilo

MyGo + React 的桌面 AI 工作伙伴：多 Bot、连续多条消息、思考状态展示。Agent 由 Pi（`pi --mode rpc`）驱动，使用用户配置的模型服务；新安装不带维护者的服务地址或凭据。

## 结构与职责

```
morilo/
├── main.go              # MyGo 宿主：创建主窗口、绑定服务、selftest 入口
├── agent.go             # Chat 服务：每个会话一个 pi RPC 子进程；ChatEvent 流
├── connections.go       # 模型/Instabox 配置、系统凭据、onboarding 与创建恢复
├── provider_config.go   # 非敏感模型元数据与 managed Pi 配置
├── runtime.go           # 优先使用随包 Node + Pi，开发模式允许已安装 Pi
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
npm run prepare:runtime # 校验并准备固定 Node/Pi；随后开发也不需要全局 Pi
npm run build      # 准备随包运行时 → mygo build → .app + .dmg → build/darwin-<arch>/
npm run generate   # 重新生成 frontend/src/mygo.ts
go test ./...      # 离线业务测试；付费模型往返默认跳过
MORILO_LIVE_TEST=1 go test . -run '^TestPiSessionRoundTrip$' -v # 可选旧 Pi 配置往返，需有效模型凭据
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

全新隔离目录现在首先进入 onboarding，没有聊天输入框时会记录 `no textarea`、气泡数为 0。这能验收首次启动界面，不能据此声称真实聊天成功。配置后的聊天、浅色 Settings 采用必要的手动检查；不要增加 UI 自动化测试。随包运行时的离线请求验证为 `MORILO_PACKAGED_RESOURCES="<app>/Contents/Resources" go test . -run '^TestPackagedModelConnection$'`，它使用本机 HTTP fixture，不调用付费模型。

## 已完成功能（按时间序）

1. **MyGo 化改造**：React 项目原样迁入 `frontend/`；MyGo WebView 模式承载；`Morilo.app`+dmg 打包跑通。
2. **Chat 服务（Go↔Pi↔前端）**：`Chat.Send` 带 `*mygo.Channel[ChatEvent]`，channel 生命周期=一次 run；每会话一个 `pi --mode rpc` 子进程保上下文；`Chat.Stop`（abort）/`Chat.Reset`（杀进程）已就绪。
3. **流式渲染**：`text_delta` → agent 气泡；`thinking_delta`/`tool_execution_*` 只更新输入框上方「头像+一句进度」状态条（`.agent-status`，run 结束消失）——工具执行事件不再写入 UI 聊天记录，界面不展示工具名/参数/原始结果或原始推理；Pi 自身会话存储不变，Agent 正常回复中的代码保留。`error`/发送失败仍是 `sender:'event'` 持久事件行。历史 `taskTitle` 事件行在渲染与导出时过滤隐藏，日期等其它事件行保留。
4. **多消息气泡（连续短消息）**：两层机制——pi 的每个 assistant `message_start` 为一个气泡段（`ChatEvent.seg`）；`--append-system-prompt` 约定多条短消息用 `¶` 分隔，前端按 `¶` 实时切泡。已截图验收。
   - 每条 agent 消息的工具条（表情/引用/更多，`MessageToolbar`）显示在气泡**右侧**垂直居中而非下方：`.message-row--agent` 为 `flex-direction: row`，平时 `opacity:0`、hover 显示。已截图验收。
5. **会话持久化**：`Store`（load/save，600ms 防抖）写 `~/Library/Application Support/Morilo Dev/state.json`（发布构建为 `~/Library/Application Support/Morilo/state.json`）；pi 用 `--session-dir` + `--session-id <convId>`，重启续上下文。
6. **用户模型配置（隔离）**：onboarding 和 Settings → Model 共用表单，接受协议、Base URL、模型 ID、API key，以及能力与上下文上限。保存前通过独立临时 Pi 进程验证；失败不替换原连接。
   - `connections.json` 仅保存非敏感元数据和不透明的凭据账户引用；API key 使用系统凭据存储。
   - 受管理的 `models.json` / `settings.json` / `auth.json` 写入 `<userData>/pi-agent/managed`。模型 key 只通过 `MORILO_MODEL_API_KEY` 传给对应子进程，文件中不保存明文。
   - 已有 `<userData>/pi-agent` 根目录配置保留并兼容；不修改旧文件，不复用全局 `~/.pi/agent` 配置。新安装不会补写个人中转地址或默认模型。
   - 新安装默认为 `chat`，无电脑和应用工具。用户确认后可启用 `local`，或配置、验证 Instabox 后启用 `remote`；活动聊天期间连接修改会返回稍后重试。
7. **selftest**：`MYGO_SELFTEST=1` 时自动走真实 UI 发消息+截图（见上）。
8. **无边框窗口**：`TitleBarStyle: TitleBarHiddenInset` + `TrafficLightPosition{15,17}`——原生红绿灯内嵌浮在页面上、与侧栏工具行垂直居中；页面用 `--app-region: drag` 标拖拽区（`.sidebar__actions`/`.chat-header`/`.agent-profile`，按钮自动 no-drag）；`--mygo-titlebar-inset-left` 变量给红绿灯让位；`.app-stage`/`.app-shell` 的假外壳（padding/边框/圆角/阴影）已拆，应用自身即窗口边界。已截图验收（红绿灯是原生控件不进 webview 截图）。
9. **远程电脑（用户的 Instabox）**：通过 onboarding / Settings → Computer 保存个人 API key，列出账户机器，验证启动状态与桌面权限后选择；原环境变量 `INSTABOX_API_KEY` / `INSTABOX_MACHINE_ID` / `INSTABOX_API_URL` 仅保留兼容路径。未配置的新安装采用 chat 模式，本机工具需要用户确认启用。
   - 创建机器要求名称与规格/费用确认，使用 `agent-browser` 模板。提交前持久化幂等键；超时、重启后恢复同一请求，避免重复创建。停止跟踪不会删除机器或停止计费；创建未结束时不允许更换密钥。
   - `computer.Backend` 实现 Info/Wake/Exec/ReadFile/WriteFile/Screenshot/Act/DesktopURL。`Connections` 管理配置与创建，`Computer` 仅向前端暴露 Status/Connect；Pi 经 `127.0.0.1:0` 上随机 Bearer token 鉴权的工具桥访问 Go，Instabox API key 不传给 Pi。
   - 内嵌 `computer/extension.ts` 注册 computer_exec/read/write/desktop。remote 模式禁用本机内置工具；桌面操作使用 argv+stdin，无 shell 插值，截图使用 scrot / DISPLAY=:1。
   - `ComputerPanel` 默认 view-only，Take control 才请求交互链接；这不是暂停或锁定 Pi。展开使用原生 dialog，切换机器时清除旧 iframe；未配置时引导到 Settings。浏览器预览不连接远端。
   - HTTP 契约、幂等恢复、权限拒绝、持久化失败有本机 fixture 测试；这不等于已验证真实账户的付费创建。
10. **设置/本地资料（Settings）**：`Settings` 绑定服务持久化 `settings.json`（0600 原子写）：Preferences（theme/accent/language/spellcheck/microphoneId/timezone，枚举+IANA 校验）+ 多 `LocalProfile`（id/name/email/memory，仅本地无云登录）+ activeProfileId；`SelectProfile('')` = 退出到选择页不删数据。Store/Chat 按 profile 分域：首 profile 仍用旧 `state.json` 与旧 pi session id，其余走 `profiles/<id>/` 与 `profileID:convID`；每条消息经 `contextMessage` 注入时区/当前时间/`<imported_memory>`。记忆导入限 .txt/.md/.json、64KiB、JSON 格式化追加。前端 `SettingsProvider`（MyGo 走服务、浏览器走 localStorage `morilo-settings`，串行写入，`t(zh,en)` 行内翻译、matchMedia 主题 → `documentElement.dataset.theme` + `mygo.Theme.SetSource`）；`App` = 加载/出错边界 → 无 active profile 时 `LocalProfilePicker` → `ConversationApp key=profileID`；Store.save 带 profileID、卸载时 flush。General 设置通过服务持久化；硬件加速/安全密钥为禁用态说明文案；麦克风测试仅本地电平。前端 `useIntegrationStore(integrationsOpen)` 仅在打开集成面板时刷新连接状态（启动/聚焦不再自动请求，显式刷新与变更操作照常）。Composio 集成由 `Integrations` 服务 + `MORILO_APPS_*` 桥接（`Chat.integrations`，piEnv 会剥 `COMPOSIO_API_KEY`/`MORILO_APPS_*`）；Composio key 存 OS 凭据服务 `dev.morilo.app.integrations`/`composio-api-key`，不落文件；macOS 开发构建例外走稳定的 `/usr/bin/security` 客户端读/写（自签应用的分区 ACL 按 CDHash 变，生产仍用 mygo.Secrets，同一登录钥匙串 service/account，无明文落盘、诊断不导出密钥）；仅支持 GitHub/Vercel，开放六个只读白名单工具。`MYGO_SELFTEST=1` 现在用临时 userData 目录隔离，不碰真实用户数据。
11. **开发诊断**：仅开发构建且非 MYGO_SELFTEST 时启用 .mygo/diagnostics（目录 0700，文件 0600，不入 Git）。ready.json 提供 pid；request.json 为 {id,pid,action,appId?,slug?,arguments?}，response.json 按 id/pid 匹配返回 data/error。一次一个请求；支持 status/open-apps/screenshot/connect/tools/run，以及固定的 acceptance-start/acceptance-status，无任意 JS、shell 或密钥导出接口。status 只返回钥匙串是否存有密钥及当前资料的连接状态；连接及工具调用仍走 Integrations 的资料隔离、授权 URL 校验和只读工具白名单。acceptance-start 在当前真实资料中新建验收 Bot，通过真实输入框发送固定的六项只读查询；acceptance-status 观察实际 Chat 事件及渲染后的界面。生产构建无此入口。
12. **聊天展示**：普通回复不主动播报工具名、调用参数或日志，明确的 API/调试请求仍可展示技术细节。Agent 消息使用 react-markdown + remark-gfm，保留默认 URL 过滤、禁用原始 HTML，图片仅显示替代文字，外链在默认浏览器打开；用户原文和历史消息数据不改写。定向检查：`npm --prefix frontend run test:markdown`。
13. **独立安装与发布**：`runtime/package.json` 和锁文件固定 Pi，`.node-version` 与 `runtime/node-checksums.json` 固定 Node 及官方归档校验值。构建将运行时及依赖许可复制到平台 resources，生产优先通过绝对路径启动包内 Node/Pi。GitHub Actions 为 main/develop/所有 tag 生成双架构包；版本 tag 只有签名、公证成功才发布 Release。Apple 发布凭据与运行时用户 key 完全分离，详见 `docs/distribution.md`。客户端自动更新尚未启用。

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
- Pi 1.5.0 → 随包运行时；开发时可回退到已安装的 `~/.local/bin/pi`
- Node 24.22.2 / npm；`mygo` CLI 走 node_modules/.bin（mygo-cli@0.7.4）
