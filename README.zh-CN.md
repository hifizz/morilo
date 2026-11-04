# Morilo

**桌面上的个人 AI 工作空间。**

[English](README.md) | 简体中文

Morilo 是一个基于 Go、MyGo 和 React 的早期桌面 AI 应用。它将多个助手和会话放在同一工作空间，支持流式回复、本地资料，以及可选的应用连接和远程电脑。Agent 会话由 Pi RPC CLI 驱动。

![Morilo 桌面界面与示例会话](docs/images/morilo-desktop.png)

*截图来自原生 macOS 界面，使用展示用示例会话，并非真实模型调用记录。*

## 功能

- **多助手、多会话**：按工作内容组织对话，不必把所有事情放进同一个线程。
- **流式、易读的回复**：支持 Markdown、连续短消息气泡，以及简洁的进度提示，不直接铺开工具日志。
- **本地资料与历史**：会话、偏好和导入记忆保存在本机，不同资料之间分开存储。
- **个性化设置**：明暗主题、强调色、中英文界面和时区上下文。
- **可选应用连接**：通过 Composio 连接 GitHub、Vercel，仅开放已实现的只读工具白名单。
- **可选远程电脑**：连接 Instabox 机器、观看桌面，并按需启用交互控制。

> **项目状态：** 当前已验证的桌面平台是 macOS。账单、邀请、例行任务及部分保险库页面仍包含演示或仅在本地生效的界面，不代表完整生产服务。纯浏览器预览使用模拟回复；真实 Agent 执行需要桌面应用和已配置的模型服务。

## 本地运行

### 环境要求

- macOS：当前已验证的原生开发流程。
- Go **1.27.3 或更新版本**。
- Node.js **24** 和 npm：已验证的开发环境。
- 支持 `pi --mode rpc` 的 Pi CLI，且 `pi` 在 `PATH` 中；已验证版本为 **1.5.0**。
- 可用的模型服务：用于真实聊天。

```bash
git clone https://github.com/hifizz/morilo.git
cd morilo
npm ci
npm --prefix frontend ci
npm run dev
```

在 macOS 上，`npm run dev` 会准备专用的本地开发签名身份，启动端口为 3000 的 Vite，并打开 **Morilo Dev.app**。该本地开发流程不要求订阅 Apple Developer。详见[开发与签名说明](docs/development.md)。

### 配置模型服务

打开界面不等于模型已经配置完成。Morilo 在应用数据目录中初始化专属 Pi 配置，**不会使用全局 Pi 配置**。

| 构建类型 | Pi 配置目录 |
| --- | --- |
| 开发版 | `~/Library/Application Support/Morilo Dev/pi-agent/` |
| 打包版 | `~/Library/Application Support/Morilo/pi-agent/` |

相关文件为 `models.json`、`settings.json` 和 `auth.json`。聊天会话启动时会初始化缺失的文件；默认配置见 [`agent.go`](agent.go)。

当前默认配置使用项目专属的 OpenAI 兼容中转服务及 `swe-2` 模型。你需要提供该服务的访问权限，**或者将 provider、模型和认证配置替换成自己的 Pi 兼容配置**。默认认证命令从 macOS 钥匙串的 `morilo-relay` 服务读取密钥；应用不附带 API Key。请勿将凭据写入仓库。

### 可选服务

- **GitHub / Vercel**：在桌面应用中打开「连接应用」，配置 Composio 项目 API Key。该密钥保存在系统凭据服务中。仍需留意连接账户的授权范围：Morilo 的工具白名单不会缩小底层 Token 自身的权限。
- **Instabox**：在启动应用前，通过环境提供 `INSTABOX_API_KEY` 和 `INSTABOX_MACHINE_ID`；`INSTABOX_API_URL` 可选。未配置时，Agent 工具在本机 `~/morilo-workspace` 中运行。

## 开发命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动原生应用和前端开发服务器 |
| `npm run build` | 构建前端并打包桌面应用 |
| `npm run generate` | 重新生成 Go 到 TypeScript 的类型化绑定 |
| `npm --prefix frontend run dev` | 仅启动浏览器预览，使用模拟回复 |
| `CGO_ENABLED=0 go test ./... -skip '^TestPiSessionRoundTrip$'` | 运行不包含真实模型往返的测试 |
| `go test . -run '^TestPiSessionRoundTrip$' -v` | 验证真实 Pi / 模型往返；需要有效凭据，可能产生模型服务费用 |
| `npm --prefix frontend run test:markdown` | 检查 Markdown 渲染与不安全内容处理 |

在已验证的 Apple Silicon 环境中，macOS 打包产物位于 `build/darwin-arm64/`。本地构建不会自动完成面向公开分发的公证。

## 项目结构

- `main.go`：桌面宿主、窗口和服务绑定。
- `agent.go`：按会话管理的 Pi RPC 进程与聊天事件流。
- `settings.go` / `store.go`：本地资料、偏好和会话持久化。
- `integrations.go` / `integrations/`：Composio 集成与只读工具桥。
- `computer.go` / `computer/`：远程电脑服务与 Instabox 适配器。
- `frontend/`：React、TypeScript、Vite 和 Tailwind 界面。
- `docs/development.md`：本地签名及系统凭据服务说明。

## 数据与凭据

本地存储不等于离线运行：提示词和导入记忆可能会发送到配置的模型服务，可选集成也会与对应服务通信。Pi 可以在你的机器上执行工具，本地执行不等于沙箱隔离。

请勿提交 API Key、本机应用数据或生成的构建产物。应用使用独立的 Pi 配置目录，不主动复用全局 Pi 凭据。

## 开源协议

[MIT](LICENSE) — Copyright (c) 2026 hifizz。第三方依赖保留各自的许可证。
