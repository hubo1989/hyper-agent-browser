# hyper-agent-browser (hab)

**纯浏览器自动化 CLI，专为 AI Agent 设计**

[![npm version](https://img.shields.io/npm/v/hyper-agent-browser.svg)](https://www.npmjs.com/package/hyper-agent-browser)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.1.0-orange.svg)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

## ✨ 特性

- 🎯 **@eN 元素引用** - 无需手写选择器，自动生成 `@e1`, `@e2` 等引用
- 🔐 **Session 持久化** - 保持登录状态，支持多账号隔离
- 🎭 **反检测** - 基于 Patchright，绕过自动化检测
- ⚡ **快速启动** - Bun 运行时，冷启动 ~25ms
- 🤖 **AI Agent 友好** - 设计用于 Claude Code 等 AI Agent 调用
- 🔒 **安全加固** - 沙箱隔离、权限控制、Session 保护
- 📊 **数据提取** - 表格/列表/表单/元数据自动提取
- 🌐 **网络监听** - 拦截 XHR/Fetch 请求，直接获取 API 数据
- ⏳ **智能等待** - 网络空闲 + DOM 稳定双重策略

## 🚀 快速开始

### 安装

**使用 npm（推荐）**

```bash
# 全局安装
npm install -g hyper-agent-browser

# 或使用 Bun
bun install -g hyper-agent-browser

# 或使用 npx（无需安装）
npx hyper-agent-browser --version
```

**从源码安装**

```bash
git clone https://github.com/hubo1989/hyper-agent-browser.git
cd hyper-agent-browser
bun install
bun run build  # 构建二进制文件到 dist/hab
```

**下载预编译二进制文件**

访问 [GitHub Releases](https://github.com/hubo1989/hyper-agent-browser/releases) 下载对应平台的二进制文件。

### 基础使用

```bash
# 1. 打开网页（有头模式，可以看到浏览器）
hab --headed open https://google.com

# 2. 获取可交互元素快照
hab snapshot -i

# 输出示例:
# URL: https://google.com
# Title: Google
#
# Interactive Elements:
# @e1  [textbox]   "Search" (focused)
# @e2  [button]    "Google Search"
# @e3  [button]    "I'm Feeling Lucky"
# @e4  [link]      "Gmail"
# @e5  [link]      "Images"

# 3. 使用 @eN 引用操作元素
hab fill @e1 "Bun JavaScript runtime"
hab press Enter

# 4. 等待页面加载
hab wait 2000

# 5. 截图
hab screenshot -o result.png

# 6. 获取页面内容
hab content
```

### Session 管理（多账号隔离）

```bash
# 个人 Gmail 账号
hab -s personal-gmail open https://mail.google.com
hab -s personal-gmail snapshot -i

# 工作 Gmail 账号
hab -s work-gmail open https://mail.google.com
hab -s work-gmail snapshot -i

# 列出所有 Session
hab sessions

# 关闭特定 Session
hab close -s personal-gmail
```

### 数据提取（新增）

```bash
# 提取表格数据
hab open https://example.com/users
hab extract-table > users.json

# 提取列表数据（自动检测商品/文章列表）
hab extract-list --selector ".product-list" > products.json

# 提取表单状态
hab extract-form > form_data.json

# 提取页面元数据（SEO/OG/Schema.org）
hab extract-meta --include seo,og > metadata.json
```

### 网络监听（新增）

```bash
# 启动网络监听
LISTENER_ID=$(hab network-start --filter xhr,fetch --url-pattern "*/api/*" | jq -r '.listenerId')

# 执行操作（翻页/点击等）
hab click @e5
hab wait-idle

# 停止监听并获取所有 API 数据
hab network-stop $LISTENER_ID > api_data.json
```

### 智能等待（新增）

```bash
# 等待页面完全空闲（网络 + DOM）
hab wait-idle --timeout 30000

# 等待元素可见
hab wait-element "css=.data-row" --state visible

# 等待加载动画消失
hab wait-element "css=.loading" --state detached
```

## 📖 完整命令列表

### 导航命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `open <url>` | 打开网页 | `hab open https://example.com` |
| `reload` | 刷新当前页面 | `hab reload` |
| `back` | 后退 | `hab back` |
| `forward` | 前进 | `hab forward` |

### 操作命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `click <selector>` | 点击元素 | `hab click @e1` |
| `fill <selector> <value>` | 填充输入框 | `hab fill @e1 "hello"` |
| `type <text>` | 逐字输入文本 | `hab type "password"` |
| `press <key>` | 按键 | `hab press Enter` |
| `scroll <direction> [amount]` | 滚动页面 | `hab scroll down 500` |
| `hover <selector>` | 悬停在元素上 | `hab hover @e3` |
| `select <selector> <value>` | 选择下拉选项 | `hab select @e2 "Option 1"` |
| `wait <ms\|condition>` | 等待时间或条件 | `hab wait 3000` |

### 信息命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `snapshot [-i\|--interactive]` | 获取页面快照 | `hab snapshot -i` |
| `screenshot [-o <file>] [--full-page]` | 截图 | `hab screenshot -o page.png` |
| `url` | 获取当前 URL | `hab url` |
| `title` | 获取页面标题 | `hab title` |
| `content [selector]` | 获取文本内容 | `hab content` |
| `evaluate <script>` | 执行 JavaScript | `hab evaluate "document.title"` |

### Session 命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `sessions` | 列出所有 Session | `hab sessions` |
| `close [-s <name>]` | 关闭 Session | `hab close -s gmail` |

### 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-s, --session <name>` | 指定 Session 名称 | `default` |
| `--headed` | 有头模式（显示浏览器） | `false` |
| `--channel <chrome\|msedge>` | 浏览器类型 | `chrome` |
| `--timeout <ms>` | 超时时间 | `30000` |

## 🤖 AI Agent 集成（Claude Code）

hyper-agent-browser 专为 AI Agent 设计，可与 Claude Code 无缝集成。

### 安装 Skill 文件

```bash
# 方法 1：从本地仓库复制
mkdir -p ~/.claude/skills
cp skills/hyper-browser.md ~/.claude/skills/

# 方法 2：直接下载
curl -o ~/.claude/skills/hyper-browser.md \
  https://raw.githubusercontent.com/hubo1989/hyper-agent-browser/main/skills/hyper-browser.md
```

### 使用示例

安装 Skill 后，Claude Code 会自动识别并使用 `hab` 命令。你可以这样指示 Claude：

```
"帮我打开 Google 搜索 'Bun runtime' 并截图"
"登录我的 Gmail 账号，找到未读邮件数量"
"访问 Twitter 并获取首页的所有推文标题"
```

Claude 会自动：
1. 使用 `hab open` 打开网页
2. 使用 `hab snapshot -i` 获取元素引用
3. 分析快照，找到目标元素（如 `@e5`）
4. 使用 `hab click @e5` 等命令完成操作

### Skill 功能

- ✅ 自动解析 `@eN` 引用
- ✅ Session 管理（多账号隔离）
- ✅ 错误处理和重试
- ✅ 浏览器状态保持
- ✅ 登录状态持久化

## 📋 选择器格式

hyper-agent-browser 支持多种选择器格式：

| 格式 | 示例 | 说明 | 推荐度 |
|------|------|------|--------|
| `@eN` | `@e1`, `@e5` | 元素引用（来自 snapshot） | ⭐⭐⭐⭐⭐ |
| `css=` | `css=#login` | CSS 选择器 | ⭐⭐⭐ |
| `text=` | `text=Sign in` | 文本匹配 | ⭐⭐⭐⭐ |
| `xpath=` | `xpath=//button` | XPath 选择器 | ⭐⭐ |

**推荐使用 `@eN` 引用**：
- 无需手写选择器
- 自动处理动态 ID/Class
- AI Agent 友好

## 🎯 核心功能详解

### 1. 元素引用系统

不需要手写复杂的选择器：

```bash
# 传统方式（繁琐、易出错）
hab click 'css=button.MuiButton-root.MuiButton-contained.MuiButton-sizeMedium'

# hyper-agent-browser 方式（简单、可靠）
hab snapshot -i  # 自动生成 @e1, @e2... 引用
hab click @e5    # 直接使用引用
```

### 2. Session 持久化

每个 Session 有独立的：
- 浏览器实例
- UserData 目录（Cookies/LocalStorage）
- 登录状态
- 浏览历史

```
~/.hab/sessions/
├── default/
│   ├── userdata/      # Chrome UserData
│   ├── session.json   # 元数据（wsEndpoint/pid/url）
│   └── element-refs.json  # @eN 映射
├── gmail-personal/
└── gmail-work/
```

### 3. 浏览器复用

CLI 每次调用是独立进程，但浏览器实例会持久化复用：

```bash
# 第一次：启动新浏览器 (~1-2s)
hab --headed open https://google.com

# 后续调用：复用浏览器 (~50ms)
hab snapshot -i
hab click @e1
```

## 🔒 安全特性

hyper-agent-browser v0.1.0 包含全面的安全加固：

### 1. evaluate 命令沙箱

- ✅ 白名单模式（仅允许安全的 document/window 操作）
- ✅ 增强黑名单（阻止 eval/Function/constructor/globalThis）
- ✅ 结果大小限制（最大 100KB，防止数据窃取）

### 2. Session 文件权限保护

- ✅ session.json 权限设置为 `0o600`（仅所有者可读写）
- ✅ 保护 wsEndpoint 不被其他进程劫持

### 3. 配置文件权限保护

- ✅ config.json 权限设置为 `0o600`
- ✅ 保护敏感配置

### 4. Chrome 扩展安全验证

- ✅ 扩展白名单机制
- ✅ 自动检查扩展 manifest 危险权限
- ✅ 过滤含 debugger/webRequest/proxy 权限的扩展

### 5. 系统 Keychain 隔离

- ✅ 默认使用隔离的密码存储
- ✅ 通过 `HAB_USE_SYSTEM_KEYCHAIN=true` 显式启用

### 6. 配置键白名单验证

- ✅ 仅允许修改安全的配置键
- ✅ 阻止危险浏览器参数注入

## 🏗️ 架构

```
src/
├── cli.ts              # CLI 入口（Commander.js）
├── browser/
│   ├── manager.ts      # 浏览器生命周期管理
│   └── context.ts      # BrowserContext 封装
├── session/
│   ├── manager.ts      # Session 管理（多浏览器实例）
│   └── store.ts        # UserData 持久化
├── commands/
│   ├── navigation.ts   # open/reload/back/forward
│   ├── actions.ts      # click/fill/type/press/scroll
│   ├── info.ts         # snapshot/screenshot/evaluate
│   └── session.ts      # sessions/close
├── snapshot/
│   ├── accessibility.ts    # 从 Accessibility Tree 提取元素
│   ├── dom-extractor.ts    # DOM 提取器（fallback）
│   ├── formatter.ts        # 格式化输出
│   └── reference-store.ts  # @eN 映射存储
└── utils/
    ├── selector.ts     # 选择器解析
    ├── config.ts       # 配置管理
    ├── errors.ts       # 错误处理
    └── logger.ts       # 日志
```

## 📊 技术栈

- **Bun** 1.2.21 - JavaScript 运行时
- **Patchright** 1.57.0 - 反检测 Playwright fork
- **Commander.js** 12.1.0 - CLI 框架
- **Zod** 3.25.76 - 数据验证
- **Biome** 1.9.4 - 代码规范

## 🛠️ 开发

```bash
# 克隆仓库
git clone https://github.com/hubo1989/hyper-agent-browser.git
cd hyper-agent-browser

# 安装依赖
bun install

# 开发模式运行
bun dev -- --headed open https://google.com

# 运行测试
bun test

# 类型检查
bun run typecheck

# 代码规范检查
bun run lint

# 构建
bun run build       # 当前平台
bun run build:all   # 所有平台
```

## 📚 文档

- [GETTING_STARTED.md](./GETTING_STARTED.md) - 快速入门指南
- [ELEMENT_REFERENCE_GUIDE.md](./ELEMENT_REFERENCE_GUIDE.md) - @eN 引用完整文档
- [GOOGLE_PROFILE_GUIDE.md](./GOOGLE_PROFILE_GUIDE.md) - Google Profile 集成
- [CLAUDE.md](./CLAUDE.md) - 开发者文档
- [hyper-agent-browser-spec.md](./hyper-agent-browser-spec.md) - 技术规格
- [Skill 文档](./skills/hyper-browser.md) - Claude Code Skill 说明

## 🤝 贡献

欢迎 Pull Requests！请确保：

- ✅ TypeScript 类型检查通过：`bun run typecheck`
- ✅ 测试通过：`bun test`
- ✅ 代码规范检查通过：`bun run lint`

## 📄 许可证

[MIT](./LICENSE)

## 🔗 相关链接

- **npm 包**: https://www.npmjs.com/package/hyper-agent-browser
- **GitHub**: https://github.com/hubo1989/hyper-agent-browser
- **Issues**: https://github.com/hubo1989/hyper-agent-browser/issues
- **Releases**: https://github.com/hubo1989/hyper-agent-browser/releases

## 🙏 致谢

- [Patchright](https://github.com/Patchright/patchright) - 反检测 Playwright fork
- [agent-browser](https://github.com/anthropics/agent-browser) - CLI 设计灵感
- [Bun](https://bun.sh) - 快速的 JavaScript 运行时
- [Claude Code](https://claude.ai/code) - AI 编程助手

---

**Made with ❤️ for AI Agents**
