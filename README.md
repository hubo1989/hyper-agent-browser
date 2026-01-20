# hyper-agent-browser (hab)

**纯浏览器自动化 CLI，专为 AI Agent 设计**

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.1.0-orange.svg)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

## ✨ 特性

- 🎯 **@eN 元素引用** - 无需手写选择器，自动生成 `@e1`, `@e2` 等引用
- 🔐 **Session 持久化** - 保持登录状态，支持多账号隔离
- 🎭 **反检测** - 基于 Patchright，绕过自动化检测
- ⚡ **快速启动** - Bun 运行时，冷启动 ~25ms
- 🤖 **AI Agent 友好** - 设计用于 Claude Code 等 AI Agent 调用

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/hyper-agent-browser.git
cd hyper-agent-browser

# 安装依赖
bun install
```

### 基础使用

```bash
# 1. 打开网页
bun dev -- --headed open https://google.com

# 2. 获取可交互元素快照
bun dev -- snapshot -i

# 输出:
# @e1  [textbox]   "Search"
# @e2  [button]    "Google Search"
# @e3  [link]      "Gmail"

# 3. 使用 @eN 引用操作元素
bun dev -- fill @e1 "Bun JavaScript runtime"
bun dev -- press Enter

# 4. 截图
bun dev -- screenshot -o result.png
```

### 使用已登录的 Google Profile

```bash
# 导入 Chrome Profile（保留登录状态）
./scripts/import-chrome-profile.sh -s gmail

# 使用已登录状态访问 Gmail
bun dev -- -s gmail --headed open https://mail.google.com
bun dev -- -s gmail snapshot -i
```

## 📖 文档

- [GETTING_STARTED.md](./GETTING_STARTED.md) - 快速入门指南
- [ELEMENT_REFERENCE_GUIDE.md](./ELEMENT_REFERENCE_GUIDE.md) - @eN 引用完整文档
- [GOOGLE_PROFILE_GUIDE.md](./GOOGLE_PROFILE_GUIDE.md) - Google Profile 集成
- [CLAUDE.md](./CLAUDE.md) - 开发者文档
- [hyper-agent-browser-spec.md](./hyper-agent-browser-spec.md) - 技术规格

## 🎯 核心功能

### 元素引用系统

不需要手写复杂的选择器：

```bash
# 传统方式（繁琐）
hab click 'css=button.MuiButton-root.MuiButton-contained'

# hyper-agent-browser 方式（简单）
hab snapshot -i  # 生成引用
hab click @e5    # 使用引用
```

### Session 管理

每个 session 独立的浏览器环境：

```bash
# 个人账号
bun dev -- -s personal open https://mail.google.com

# 工作账号
bun dev -- -s work open https://mail.google.com

# 列出所有 session
bun dev -- sessions
```

### 支持的命令

**导航**: `open`, `reload`, `back`, `forward`
**操作**: `click`, `fill`, `type`, `press`, `scroll`, `hover`, `select`, `wait`
**信息**: `snapshot`, `screenshot`, `evaluate`, `url`, `title`, `content`
**会话**: `sessions`, `close`

## 🛠️ 开发

```bash
# 运行测试
bun test

# 类型检查
bun run typecheck

# 代码规范检查
bun run lint

# 构建
bun run build                  # 当前平台
bun run build:all              # 所有平台
```

## 🤖 AI Agent 集成

hyper-agent-browser 专为 AI Agent 设计。安装 Skill 文件：

```bash
mkdir -p ~/.claude/skills
cp skills/hyper-browser.md ~/.claude/skills/
```

**使用流程**:
1. Agent 打开网页：`hab open <url>`
2. Agent 获取快照：`hab snapshot -i`
3. Agent 分析快照，找到目标元素 `@eN`
4. Agent 执行操作：`hab click @eN`
5. 重复直到任务完成

## 📋 选择器格式

| 格式 | 示例 | 说明 |
|------|------|------|
| `@eN` | `@e1`, `@e5` | 元素引用（推荐） |
| `css=` | `css=#login` | CSS 选择器 |
| `text=` | `text=Sign in` | 文本匹配 |
| `xpath=` | `xpath=//button` | XPath |

## 🏗️ 架构

```
src/
├── cli.ts              # CLI 入口
├── browser/            # 浏览器管理
├── session/            # Session 持久化
├── commands/           # 命令实现
├── snapshot/           # 元素引用系统
│   ├── accessibility.ts    # Accessibility API
│   ├── dom-extractor.ts    # DOM 提取器（fallback）
│   └── reference-store.ts  # @eN 映射存储
└── utils/              # 工具函数
```

## 🔒 安全

- Session 目录权限 700（仅用户可访问）
- `evaluate` 命令禁止危险操作（require, process, fs 等）
- UserData 独立隔离，不影响系统 Chrome

## 📊 技术栈

- **Bun** 1.2.21 - JavaScript 运行时
- **Patchright** 1.57.0 - 反检测 Playwright fork
- **Commander.js** 12.1.0 - CLI 框架
- **Zod** 3.25.76 - 数据验证
- **Biome** 1.9.4 - 代码规范

## 🤝 贡献

欢迎 Pull Requests！请确保：

- TypeScript 类型检查通过：`bun run typecheck`
- 测试通过：`bun test`
- 代码规范检查通过：`bun run lint`

## 📄 许可证

MIT

## 🙏 致谢

- [Patchright](https://github.com/Patchright/patchright) - 反检测 Playwright fork
- [agent-browser](https://github.com/anthropics/agent-browser) - CLI 设计灵感
- [Bun](https://bun.sh) - 快速的 JavaScript 运行时

