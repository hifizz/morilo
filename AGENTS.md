# Grokbot

MyGo + React 的桌面 AI Bot 应用，Grok BOT 风格：多 Bot、连续多条消息、思考状态展示。Agent 由 Pi（`pi --mode rpc`）驱动，走自家中转站。

## 结构与职责

```
grokbot/
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
npm run dev        # = mygo dev：Vite :3000 + 构建并打开 Grokbot Dev.app，改代码自动重载
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
# 等日志出现 "selftest done: /tmp/grokbot-shot.png, agent bubbles: N"
```

selftest（main.go）会等页面加载后：向真实输入框注入 prompt → 回车发送 → 轮询 `.agent-status` 消失 → `win.CapturePage()` 截图存 `/tmp/grokbot-shot.png` → 统计 `.message-row--agent` 气泡数。读这张图确认效果。

## 已完成功能（按时间序）

1. **MyGo 化改造**：React 项目原样迁入 `frontend/`；MyGo WebView 模式承载；`Grokbot.app`+dmg 打包跑通。
2. **Chat 服务（Go↔Pi↔前端）**：`Chat.Send` 带 `*mygo.Channel[ChatEvent]`，channel 生命周期=一次 run；每会话一个 `pi --mode rpc` 子进程保上下文；`Chat.Stop`（abort）/`Chat.Reset`（杀进程）已就绪。
3. **流式渲染**：`text_delta` → agent 气泡；`thinking_delta` → 输入框上方「头像+实时思考」状态条（`.agent-status`，run 结束消失）；`tool_execution_*` → `sender:'event'` 事件行。
4. **多消息气泡（Grok 式连发）**：两层机制——pi 的每个 assistant `message_start` 为一个气泡段（`ChatEvent.seg`）；`--append-system-prompt` 约定多条短消息用 `¶` 分隔，前端按 `¶` 实时切泡。已截图验收。
   - 每条 agent 消息的工具条（表情/引用/更多，`MessageToolbar`）显示在气泡**右侧**垂直居中而非下方：`.message-row--agent` 为 `flex-direction: row`，平时 `opacity:0`、hover 显示。已截图验收。
5. **会话持久化**：`Store`（load/save，600ms 防抖）写 `~/Library/Application Support/dev.grokbot.app/state.json`；pi 用 `--session-dir` + `--session-id <convId>`，重启续上下文。
6. **专属 LLM 配置（隔离）**：`PI_CODING_AGENT_DIR=<userData>/pi-agent`，与全局 `~/.pi/agent` 完全隔离：
   - `models.json` → provider `relay`（`https://relay.zilin.im/v1`，openai-completions），模型 `swe-2`（图文）
   - `settings.json` → 默认 provider/model
   - `auth.json` → `{"relay":{"type":"api_key","key":"!/usr/bin/security find-generic-password -s grokbot-relay -w"}}` —— key 只在 macOS Keychain，不落文件
   - 缺文件时 `piAgentDir()` 自动写入默认配置
7. **selftest**：`MYGO_SELFTEST=1` 时自动走真实 UI 发消息+截图（见上）。
8. **无边框窗口**：`TitleBarStyle: TitleBarHiddenInset` + `TrafficLightPosition{15,17}`——原生红绿灯内嵌浮在页面上、与侧栏工具行垂直居中；页面用 `--app-region: drag` 标拖拽区（`.sidebar__actions`/`.chat-header`/`.agent-profile`，按钮自动 no-drag）；`--mygo-titlebar-inset-left` 变量给红绿灯让位；`.app-stage`/`.app-shell` 的假外壳（padding/边框/圆角/阴影）已拆，应用自身即窗口边界。已截图验收（红绿灯是原生控件不进 webview 截图）。
9. **远程电脑（共享 Instabox）**：设 `INSTABOX_API_KEY` + `INSTABOX_MACHINE_ID`（可选 `INSTABOX_API_URL`）即启用，缺任一保持本机模式。架构：`computer.Backend` 接口（Info/Wake/Exec/ReadFile/WriteFile/Screenshot/Act/DesktopURL）← `computer.Instabox` REST 适配；`Computer` 绑定服务只暴露 `Status`/`Connect(takeControl)`（默认 view-only 桌面 URL，可 opt-in 交互）；pi 侧不直连机器——`Computer.bridge()` 懒启 `127.0.0.1:0` HTTP 桥（随机 32B Bearer token、仅 POST、2MiB 上限），嵌入的 `computer/extension.ts` 写入 `piAgentDir()/computer-extension.ts` 注册 `computer_exec/read/write/desktop` 四工具经桥 fetch 回 Go。配好后 pi 起 `--no-builtin-tools --extension <path>` + 第二段 `--append-system-prompt`；`GROKBOT_*` 注入 pi 子进程环境，`INSTABOX_API_KEY` 永不下发。前端 `ComputerPanel`（Inspector Computer 页 + 设置 → Bot's computer，`label` 传 agent 名）：未配置显示 `INSTABOX_*` 说明；`Connect(takeControl)` 返回的签名 URL 进单个 iframe。默认 viewOnly 观看，Take control 才发 `viewOnly:false`（纯链接权限，非锁定/暂停 pi）。预览 16/10 自适应、输入禁用；常驻 `<dialog>` 里放 viewport/header/footer，展开时 `showModal()` 变全窗沉浸视图（Watch/Control pill、Minimize2 返回、Esc），iframe 节点不重建（仅切控制模式才换 URL）。右侧 `InspectorResizer`（左缘分隔条，280~`innerWidth-sidebar-320`，双击回 420，键盘可调）+ `.app-shell` 第三列 `clamp()`；浏览器预览固定「请在桌面应用中连接远程电脑」。桌面操作全走 argv+stdin（无 shell 插值），截图 `scrot` DISPLAY=:1。已验证：extension 在真实 pi 里加载并经桥调通 fake backend（computer_exec 事件+命令落账）；真机未测（无 key）。

## 关键行为约定

- pi 工具工作目录：`~/grokbot-workspace`
- 输入框在 run 期间禁用；「清空当前会话」同时 `Chat.reset` 杀掉该会话 agent
- 纯浏览器打开 :3000（无 `window.mygo`）时走演示假回复，便于前端独立开发
- `¶` 是消息切泡分隔符：内容本身含 `¶` 会误切（已知边界，遇再收紧）

## 环境

- Go 1.27.3 → `~/.local/go`（需在 PATH）
- pi 1.5.0 → `~/.local/bin/pi`（本机全局安装，供子进程调用）
- Node 24 / npm；`mygo` CLI 走 node_modules/.bin（mygo-cli@0.7.4）
