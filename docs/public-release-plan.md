# 面向第三方用户的发布方案

状态：已按本文实现——连接管理与 onboarding（Phase 1/2）、内置运行时打包（Phase 3）代码均已落地并验收，CI 打包/发布流程见 [distribution.md](distribution.md)。Apple 签名与公证为可选增强而非发布门槛；仍待完成：真实 Instabox 创建流程的线上验证。后文保留原始设计推导以便审阅。

## 目标与首版范围

用户下载安装包后，只需配置自己的模型服务即可聊天；远程电脑和应用集成为可选功能。模型与远程电脑的费用由用户自己的服务账户承担。

建议首版发布 macOS Apple Silicon 与 Intel 安装包。Windows/Linux 后续分别验证运行时、凭据存储与安装体验，再加入发布矩阵。

本机连接配置由所有 Bot 共用；本地资料继续隔离聊天与记忆。设置页面应明确连接配置的作用范围。

## 当前需要补齐的地方

| 项目 | 当前实现 | 发布前目标 |
| --- | --- | --- |
| 模型服务 | `agent.go` 默认写入项目中转地址、`swe-2`，通过 Keychain 命令读取密钥 | 新用户通过界面选择服务、模型并输入自己的 key；不预设维护者的中转服务 |
| Pi 运行时 | 从 PATH 或 `~/.local/bin/pi` 查找用户安装的 Pi | 安装包内置固定版本 Pi 及所需运行时/资源；用户不必安装开发工具 |
| Instabox | 从启动环境读取 key、machine ID，修改后需要重启 | 界面配置、列出机器、创建机器、验证连接并持久保存 |
| GitHub/Vercel | 用户提供 Composio 项目 key，再连接自己的账户 | 保留为可选的高级设置，不阻塞首次聊天 |
| 初始数据 | 首个本地资料会使用演示会话与 Bot 数据 | 新安装使用干净的欢迎页与默认助手；已有用户数据原样保留 |
| 权限、账单、更新 | 部分控件仅更新 React 状态，账单及版本存在演示值 | 隐藏未实现入口或明确标注；权限控件必须接入执行逻辑后才对用户承诺生效 |
| 打包 | MyGo 可本机打包，尚无 GitHub Actions workflow | 分支自动生成测试包，版本 tag 生成正式发布产物 |

## 用户配置与存储

### 模型连接

界面需要四项信息，而不只是 Base URL 和 key：

- 服务类型/协议：提供常用服务预设和 OpenAI-compatible 自定义入口。
- Base URL：预设自动填写，自定义服务可编辑。
- API key：用户提供；支持无需 key 的本地服务时明确提供该选项。
- 模型：尝试获取模型列表，接口不支持列表时允许手填模型 ID。

“验证并继续”在用户选定的服务上执行一次简短的真实调用，提前显示这一行为。仅检查 key 非空或模型列表可访问，不足以证明聊天可用。分别显示凭据错误、模型不可用、网络失败和钥匙串拒绝访问；配置失败时不回退到维护者的服务。

首版继续使用现有 Pi 架构，不另加 AI SDK。自定义模型的协议和能力需要与 Pi 配置一致，不能把所有 Base URL 都当作同一种 API。

### 本地保存

- 密钥通过 Go 宿主存入操作系统凭据服务；macOS 使用 Keychain，复用现有 MyGo Secrets 能力。
- 普通配置只保存 provider、Base URL、model ID、Instabox machine ID 等非密钥字段。
- 设置读取接口返回“已配置”等状态，不返回原始 key。输入框提交后清空；更换密钥使用显式更新操作。
- 不把 key 写入 localStorage、聊天记录、诊断日志、命令行参数或安装包。
- Instabox/Composio 的 key 不下发给 Pi 工具或远程机器。
- 既有模型配置及迁移后的凭据需要识别并保留，不用新用户默认值覆盖。

## 首次引导

### 1. 连接模型

填写服务、地址、key 和模型，验证后继续。昵称可选，语言默认跟随系统，不要求注册 Morilo 云账户。

没有模型配置时可以浏览设置，但发送入口应引导配置，不再直接暴露 Pi 的 `/login` 错误。

### 2. 选择工作环境

提供聊天、本机工具、Instabox 远程电脑三种明确的状态：

- 聊天：不开启电脑执行工具。
- 本机工具：明确说明会在用户电脑上读写文件和执行命令，由用户启用。
- 远程电脑：配置用户自己的 Instabox 账户和机器。

建议新用户默认从聊天开始。可以跳过远程电脑，以后从 Settings → Computer 配置。现有用户保留原来的工作模式。

### 3. 完成

展示模型连接和工作环境的验证结果，进入干净的聊天界面。GitHub/Vercel 连接放到后续的“连接应用”入口。

后续调整使用同一套 Settings 表单和后端接口，不维护两套配置逻辑。模型或机器切换在空闲时生效，重新建立相关 Pi 会话与工具桥，避免运行中的任务突然换目标。

## Instabox：选择或创建机器

### 输入 key 与选择机器

用户输入自己的 API key 后，通过 Go 宿主调用 `GET /v1/machines`，处理 `nextCursor` 分页。列表展示名称、状态和规格，默认无需用户复制 machine ID。

列表为空时显示“创建远程电脑”；有机器时也保留创建入口。空列表、请求失败和权限不足是不同状态，不能把请求失败显示为“没有机器”。

当前嵌入桌面的 `/desktop/stream` 接口要求机器创建者的个人 key。工作区 key 即便可以列出和操作机器，也可能无法生成桌面链接。首版应清楚引导使用个人工作区 key，并验证所选机器的桌面访问能力；工作区 key 的支持需要另做 VNC 转发，不能承诺现有 iframe 已支持。

### 创建表单

首版只要求用户填写机器名称，预填 `morilo-computer`：

- API 名称规则：1–63 位小写字母、数字、连字符，首位为字母或数字；名称需在用户机器中唯一。
- 默认桌面模板使用可创建的 `agent-browser`，显示为“标准桌面”，不要求用户认识模板 ID。
- 规格展示为只读摘要；当前官方默认是 4 vCPU、8 GiB 内存、20 GiB 存储，实际支持情况以账户/API 返回为准。
- 保留服务默认的空闲暂停行为；首版不增加规格、磁盘或自动删除等高级表单。

提交前显示一次确认：机器名称、所属账户/工作区、规格，以及“将在你的 Instabox 账户创建并启动机器，额度和费用按你的套餐计算”。按钮为“确认创建”，不显示未经账户计费信息验证的固定价格。

### 创建与恢复

确认后调用 `POST /v1/machines`，至少包含：

```json
{
  "name": "morilo-computer",
  "templateId": "agent-browser",
  "vault": false,
  "secrets": [],
  "envSecrets": []
}
```

这些 Secret/Vault 设置用于避免新机器自动接收账户中无关的凭据。模型 key 不属于机器创建请求。

- 每次用户确认生成一个 `Idempotency-Key`；同一次创建的网络重试复用它，避免重复创建和计费。
- 保存返回的 operation ID、machine ID 及待完成状态；轮询 `GET /v1/operations/{id}`，再核验机器运行和桌面可用状态。
- 界面依次显示“正在创建”“正在启动”“检查桌面”“已连接”。收到 `202 Accepted` 不等于机器已可使用。
- 失败或超时保留已知操作状态，恢复时查询已有操作；不因超时自动再创建一台。
- 关闭表单只结束当前等待，不暗中删除云端机器。告知用户已提交的创建仍可能继续。
- 创建成功后自动选中机器并保存 machine ID，不让用户重复复制粘贴。
- key 至少需要 `machines:write` 来创建和操作机器；无需为这条流程要求删除权限。

## Light mode 与 Settings

已查看用户提供的参考目录。参考图主要覆盖聊天、Bot 弹窗、电脑面板、应用连接与详情；其中 `SCR-20261103-plkl.png`、`SCR-20261103-plxw.png`、`SCR-20261103-pkpx.png` 可作为弹窗和表单的视觉基准。目录中未见 General Settings 的完整参考页。

已确认的代码问题：

- 浅色主题主要翻转 neutral 色阶，`--ds-surface-default` 因此仍映射为较深的灰色 `#e2e2e2`；参考图的主面板和卡片更接近白色。
- 浅色遮罩目前是 60% 白色，参考图使用暗色遮罩压低背景，弹窗层级不同。
- `.settings-scroll` 没有统一的纵向间距；General 等页面存在紧邻的多个 `SettingCard`，卡片自身也没有相邻间距规则。
- 设置控件区使用不可收缩的 flex 宽度；长标签、输入框和中英文切换需要一起检查，不能仅修一个页面的 padding。
- 侧栏底部渐变仍含硬编码的半透明黑色，浅色主题需要单独处理。

调整方向：

- 为 light/dark 分别定义语义表面色、选中态、边框、遮罩和阴影，不只翻转灰阶。
- 统一 Settings 和 onboarding 的标题、内容左右边距、分组间距、卡片间距和表单控件宽度。
- 以 8px 间距体系为基准；内容区约 24–32px 内边距、分组约 24px、同组卡片约 12–16px。最终以实际截图对照为准。
- 保持侧导航和内容滚动区域清晰，检查小窗口及中英文长文案。
- 使用隔离示例数据，对 light/dark 的聊天、Settings、连接表单截图验收；不新增 UI 自动化测试。

## 自动打包与分发

采用 GitHub Actions，macOS 包使用 macOS runner。触发条件：

```yaml
on:
  push:
    branches: [main, develop]
    tags: ["v*"]
  workflow_dispatch:
```

合并到分支会触发 push，因此不需要额外监听 PR closed 重复打包。直接推送这两个分支也会打包；若只允许合并更新，由分支保护约束。

| 来源 | 产物 |
| --- | --- |
| `develop` | 开发预览包，名称带分支与提交号，上传 Actions artifacts |
| `main` | 主线候选包，名称带提交号，上传 Actions artifacts |
| `vX.Y.Z` | 版本号校验后生成正式 Release 附件和校验和 |
| `vX.Y.Z-beta.N` 等 | 生成 prerelease 附件 |

流水线顺序：

1. Checkout；按 `go.mod` 和锁文件安装 Go、Node/npm 与构建依赖。
2. 运行无需真实用户 key 的业务逻辑测试和前端构建。
3. 准备固定版本、匹配目标架构的 Pi 与运行时资源，验证来源/校验和并携带依赖许可。
4. 通过 MyGo resources 打入 app；生产模式优先使用随包运行时，不依赖用户的 PATH。
5. 分别生成 arm64/amd64 包，签名 app 及所含 helper，执行公证并装订结果。
6. 上传产物；只有 tag 的发布任务需要 `contents: write`。发布前验证 tag 与应用版本一致。

公共安装包要获得正常的 macOS 分发体验，需要维护者的 Developer ID Application 证书及 Apple 公证凭据。它们作为发布 secrets 保存在 GitHub；模型、Instabox、Composio 的运行时 key 不进入 CI。当前本机的自签开发证书不能替代正式分发签名。

未配置正式签名时，版本 tag 也可发布到 GitHub Releases，产物明确标注为 unsigned，发布说明提供首次打开指引。配置 Developer ID 与公证凭据后自动生成 notarized 包；签名、公证是可选的分发增强，不是发布门槛。

自动出包与客户端自动更新分别实现。当前 Updates 页面是演示逻辑；首版可改为真实版本号和 Release 下载入口，后续再接入 MyGo 的签名更新机制。

## 实施顺序与验收

1. 完成连接配置与系统凭据存储，识别既有配置；补齐模型验证、Instabox 列表/创建/恢复的业务逻辑测试。
2. 完成共享的 onboarding/Settings 表单，并修正浅色主题和间距；隐藏未接入的演示权限、账单及更新承诺。
3. 内置运行时，在没有预装 Pi/Node、没有维护者凭据的新用户环境验证安装与真实调用。
4. 接入 Actions、分支产物与 tag 发布，验证两种 macOS 架构、签名和公证。

验收应覆盖：无 key 的首次启动；有效/无效模型凭据；系统凭据访问被拒绝；Instabox 空列表、分页、权限不足；创建重复点击、网络超时与恢复；已创建但未就绪；桌面链接不可用；切换模型/机器；已有用户记录不被覆盖。

已有用户的聊天、资料和原凭据始终保留。新增连接失败时不破坏先前可用配置。

## 参考

- [Instabox machines API](https://instabox.sh/docs/api/machines.md)
- [Instabox API keys](https://instabox.sh/docs/api-keys.md)
- [Instabox desktop](https://instabox.sh/docs/desktop.md)
- [MyGo distribution](https://mygo.egoist.dev/docs/distribution)
- [MyGo GitHub Actions](https://mygo.egoist.dev/docs/github-actions)
- [GitHub workflow triggers](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
