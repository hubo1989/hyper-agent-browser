# hyper-agent-browser 技术规格文档

> **项目代号**: hyper-agent-browser (HBA)  
> **版本**: 1.0.0-spec  
> **日期**: 2026-01-15  
> **状态**: Draft  
> **运行时**: Bun  
> **定位**: 纯浏览器操作 CLI，供 AI Agent 通过 Skills 调用

---

## 1. 项目概述

### 1.1 背景

现有浏览器自动化工具的问题：

| 工具 | 问题 |
|------|------|
| Playwright/Puppeteer | 需要编写代码，无 CLI |
| agent-browser | Rust + Node.js 双架构，维护复杂 |
| HyperAgent | 内置 LLM，成本不可控，无 CLI |
| Browser-use 等 | AI 决策在工具内部，不够灵活 |

### 1.2 设计理念

**将 AI 决策与浏览器操作分离**：

```
┌─────────────────┐         ┌─────────────────┐
│   AI Agent      │  Skill  │  hyper-agent-browser │
│  (Claude Code)  │ ──────► │     (CLI)        │
│                 │         │                  │
│  • 理解任务     │         │  • 执行操作       │
│  • 分析快照     │         │  • 返回结果       │
│  • 决定下一步   │         │  • 无 AI 依赖     │
└─────────────────┘         └─────────────────┘
```

**优势**：
- **成本可控** - LLM 调用在 Agent 侧，不在 CLI
- **灵活性** - 任何 AI Agent 都可以调用
- **可调试** - CLI 是确定性的，问题容易定位
- **简单** - 代码量少，依赖少，维护成本低

### 1.3 核心价值

```
一个简洁的浏览器操作 CLI，通过 Skill 暴露给 AI Agent，
让 Agent 用自然语言理解 + CLI 命令执行完成复杂任务。
```

**使用流程**：
```bash
# Agent 理解任务后，调用 CLI
$ hab open https://mail.google.com
$ hab snapshot -i
# Agent 分析快照，找到登录按钮是 @e5
$ hab click @e5
$ hab snapshot -i
# Agent 分析快照，找到输入框是 @e3
$ hab fill @e3 "user@example.com"
$ hab press Enter
# ... 循环直到任务完成
```

### 1.4 技术选型

| 特性 | 选择 | 原因 |
|------|------|------|
| 运行时 | Bun | 启动快（~25ms），原生 TS，单文件编译 |
| 浏览器驱动 | Patchright | Playwright fork，反检测 |
| CLI 解析 | Commander.js | 成熟稳定 |
| Session 持久化 | UserData 目录 | Chrome 原生支持 |

---

## 2. 系统架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AI Agent Layer                              │
│              (Claude Code / OpenCode / Codex / etc.)                │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Skill: hyper-browser                     │   │
│   │   • 描述 CLI 用法                                            │   │
│   │   • 提供操作示例                                              │   │
│   │   • 指导 Agent 如何解析 snapshot                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                ↓ Bash                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  hyper-agent-browser CLI                      │   │
│   │                       (Bun)                                 │   │
│   │                                                             │   │
│   │   Commands:                                                 │   │
│   │   • open / reload / back / forward                         │   │
│   │   • click / fill / type / press / scroll / wait            │   │
│   │   • snapshot / screenshot / evaluate                       │   │
│   │   • url / title / close / sessions                         │   │
│   │                                                             │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                ↓                                    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                  Session Manager                            │   │
│   │         (UserData 持久化 + 多 Session 隔离)                  │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                ↓                                    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     Patchright                              │   │
│   │              (Anti-Detection Playwright)                    │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                ↓                                    │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │              Chrome / Chromium / Edge                       │   │
│   │              (System Browser with UserData)                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

```
hyper-agent-browser/
├── src/
│   ├── cli.ts                 # CLI 入口
│   ├── index.ts               # SDK 入口（可选）
│   ├── browser/
│   │   ├── manager.ts         # 浏览器生命周期管理
│   │   └── context.ts         # BrowserContext 封装
│   ├── session/
│   │   ├── manager.ts         # Session 管理
│   │   └── store.ts           # UserData 持久化
│   ├── commands/
│   │   ├── navigation.ts      # open / reload / back / forward
│   │   ├── actions.ts         # click / fill / type / press / scroll
│   │   ├── info.ts            # snapshot / screenshot / evaluate / url / title
│   │   └── session.ts         # sessions / close
│   ├── snapshot/
│   │   ├── accessibility.ts   # 可访问性树提取
│   │   └── formatter.ts       # 快照格式化输出
│   └── utils/
│       ├── selector.ts        # 选择器解析 (@e1, css=, text=)
│       ├── config.ts          # 配置管理
│       └── logger.ts          # 日志
├── skills/
│   └── hyper-browser.md       # Skill 定义文件
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── examples/
│   ├── login-flow.sh          # 登录流程示例
│   └── scrape-data.sh         # 数据抓取示例
├── package.json
├── bunfig.toml
└── tsconfig.json
```

### 2.3 进程模型

采用**简单的单次执行模型**：

```
┌──────────────────────────────────────────────────────────────┐
│                     Process Model                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   每次 CLI 调用:                                              │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  $ hab --session gmail click @e5                     │  │
│   │                                                      │  │
│   │  1. Bun 启动 (~25ms)                                  │  │
│   │  2. 加载 Session 配置                                  │  │
│   │  3. 连接/启动 Browser (launchPersistentContext)       │  │
│   │  4. 执行命令                                          │  │
│   │  5. 输出结果                                          │  │
│   │  6. 保持浏览器运行（不关闭，供下次复用）                  │  │
│   │  7. CLI 进程退出                                       │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
│   浏览器进程:                                                 │
│   ┌──────────────────────────────────────────────────────┐  │
│   │  Chrome (持续运行)                                     │  │
│   │  • 首次 open 时启动                                    │  │
│   │  • 后续命令复用同一实例                                 │  │
│   │  • close 命令时关闭                                    │  │
│   │  • 空闲超时自动关闭（可配置）                           │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 技术栈

### 3.1 核心依赖

| 组件 | 技术选型 | 版本 | 用途 |
|------|----------|------|------|
| **运行时** | **Bun** | >= 1.1.0 | JS/TS 运行时 |
| 浏览器驱动 | Patchright | ^1.55.0 | 反检测 Playwright fork |
| CLI 解析 | Commander.js | ^12.0.0 | 命令行参数解析 |
| 验证 | Zod | ^3.24.0 | 配置/参数验证 |

### 3.2 开发依赖

| 工具 | 用途 |
|------|------|
| @types/bun | Bun 类型定义 |
| @biomejs/biome | 代码规范（替代 ESLint + Prettier） |
| typescript | 类型检查 |

### 3.3 package.json

```json
{
  "name": "hyper-agent-browser",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "hab": "src/cli.ts"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build --compile --minify src/cli.ts --outfile dist/hab",
    "build:all": "bun run scripts/build-all.ts",
    "test": "bun test",
    "lint": "bunx @biomejs/biome check .",
    "typecheck": "bunx tsc --noEmit"
  },
  "dependencies": {
    "patchright": "^1.55.1",
    "commander": "^12.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "bun": ">=1.1.0"
  }
}
```

### 3.4 系统要求

- **Bun**: >= 1.1.0
- **操作系统**: macOS, Linux, Windows
- **浏览器**: Chrome/Chromium/Edge (系统安装)

---

## 4. CLI 接口设计

### 4.1 命令总览

```bash
hab [全局选项] <命令> [命令选项] [参数]
```

### 4.2 全局选项

| 选项 | 简写 | 类型 | 默认值 | 描述 |
|------|------|------|--------|------|
| `--session` | `-s` | string | `default` | Session 名称 |
| `--headed` | `-H` | boolean | `false` | 显示浏览器窗口 |
| `--channel` | `-c` | string | `chrome` | 浏览器 (chrome/msedge/chromium) |
| `--timeout` | `-t` | number | `30000` | 超时时间 (ms) |
| `--verbose` | `-v` | boolean | `false` | 详细输出 |
| `--config` | | string | `~/.hab/config.json` | 配置文件路径 |

### 4.3 导航命令

#### `open` - 打开 URL

```bash
hab open <url> [选项]

选项:
  --wait-until <state>   等待状态 (load/domcontentloaded/networkidle)

# 示例
hab open https://google.com
hab --headed -s gmail open https://mail.google.com
hab open https://example.com --wait-until networkidle
```

#### `reload` - 刷新页面

```bash
hab reload
```

#### `back` - 后退

```bash
hab back
```

#### `forward` - 前进

```bash
hab forward
```

### 4.4 操作命令

#### `click` - 点击元素

```bash
hab click <selector>

# selector 格式:
#   @e1, @e2, ...     - 快照中的元素引用（推荐）
#   css=.btn          - CSS 选择器
#   text=登录          - 文本匹配
#   xpath=//button    - XPath

# 示例
hab click @e5
hab click "text=Sign in"
hab click "css=button.primary"
```

#### `fill` - 填充输入（清空后填入）

```bash
hab fill <selector> <value>

# 示例
hab fill @e3 "test@example.com"
hab fill "css=#password" "secret123"
```

#### `type` - 键入文本（逐字符，不清空）

```bash
hab type <selector> <text> [选项]

选项:
  --delay <ms>    每个字符间隔 (默认: 0)

# 示例
hab type @e3 "Hello World"
hab type @e3 "slow typing" --delay 100
```

#### `press` - 按键

```bash
hab press <key>

# 支持的按键:
#   Enter, Tab, Escape, Backspace, Delete
#   ArrowUp, ArrowDown, ArrowLeft, ArrowRight
#   Control+a, Shift+Enter, Meta+c 等组合键

# 示例
hab press Enter
hab press Tab
hab press "Control+a"
hab press "Meta+Enter"
```

#### `scroll` - 滚动

```bash
hab scroll <direction> [选项]

# direction: up | down | left | right

选项:
  --amount <pixels>   滚动像素 (默认: 500)
  --selector <sel>    在指定元素内滚动

# 示例
hab scroll down
hab scroll down --amount 1000
hab scroll up --selector "@e10"
```

#### `hover` - 悬停

```bash
hab hover <selector>

# 示例
hab hover @e5
hab hover "css=.dropdown-trigger"
```

#### `select` - 下拉选择

```bash
hab select <selector> <value>

# 示例
hab select @e7 "California"
hab select "css=#country" "China"
```

#### `wait` - 等待

```bash
hab wait <condition> [选项]

# condition:
#   <ms>              - 等待毫秒数
#   selector=<sel>    - 等待元素出现
#   hidden=<sel>      - 等待元素消失
#   navigation        - 等待导航完成

选项:
  --timeout <ms>    超时时间

# 示例
hab wait 2000
hab wait "selector=.loaded"
hab wait "hidden=.spinner"
hab wait navigation
```

### 4.5 信息获取命令

#### `snapshot` - 页面快照（核心命令）

```bash
hab snapshot [选项]

选项:
  -i, --interactive    仅显示可交互元素（推荐）
  -f, --full           完整快照（包含所有元素）
  -r, --raw            原始 JSON 格式
  -o, --output <file>  输出到文件

# 示例
hab snapshot -i              # 最常用：只看可交互元素
hab snapshot --full          # 查看完整页面结构
hab snapshot -r -o page.json # 保存原始数据
```

**输出格式（interactive 模式）**:
```
URL: https://mail.google.com/mail/u/0/#inbox
Title: Inbox - Gmail

Interactive Elements:
@e1  [link]      "Gmail"
@e2  [button]    "Search mail"
@e3  [textbox]   "Search mail" (focused)
@e4  [button]    "Search options"
@e5  [button]    "Compose"
@e6  [link]      "Inbox (3)"
@e7  [link]      "Starred"
@e8  [checkbox]  "Select" (unchecked)
@e9  [link]      "Meeting tomorrow - Hi, just wanted to..."
@e10 [link]      "Project update - The latest version..."
```

#### `screenshot` - 截图

```bash
hab screenshot [选项]

选项:
  -o, --output <file>   输出文件 (默认: screenshot.png)
  --full-page           全页面截图
  --selector <sel>      截取指定元素
  --quality <n>         JPEG 质量 1-100

# 示例
hab screenshot
hab screenshot -o page.png
hab screenshot --full-page -o full.png
hab screenshot --selector "@e5" -o button.png
```

#### `evaluate` - 执行 JavaScript

```bash
hab evaluate <script>

# 示例
hab evaluate "document.title"
hab evaluate "window.location.href"
hab evaluate "document.querySelectorAll('a').length"
hab evaluate "window.scrollTo(0, document.body.scrollHeight)"
```

#### `url` - 获取当前 URL

```bash
hab url

# 输出
https://mail.google.com/mail/u/0/#inbox
```

#### `title` - 获取页面标题

```bash
hab title

# 输出
Inbox - Gmail
```

#### `content` - 获取页面文本内容

```bash
hab content [选项]

选项:
  --selector <sel>   只获取指定元素的文本
  --max-length <n>   最大字符数 (默认: 10000)

# 示例
hab content
hab content --selector "article"
hab content --max-length 5000
```

### 4.6 会话管理命令

#### `sessions` - 列出所有 Session

```bash
hab sessions [选项]

选项:
  --json    JSON 格式输出

# 输出示例
SESSION     STATUS    BROWSER    URL                          LAST ACTIVE
default     running   chrome     https://google.com           2 min ago
gmail       running   chrome     https://mail.google.com      5 min ago
github      stopped   -          -                            2 hours ago
```

#### `close` - 关闭 Session

```bash
hab close [选项]

选项:
  --all    关闭所有 Session

# 示例
hab -s gmail close    # 关闭指定 Session
hab close             # 关闭当前 Session
hab close --all       # 关闭所有
```

### 4.7 配置命令

#### `config` - 管理配置

```bash
# 查看所有配置
hab config list

# 获取配置
hab config get timeout

# 设置配置
hab config set timeout 60000
hab config set channel msedge
hab config set headed true
```

#### `version` - 版本信息

```bash
hab version

# 输出
hyper-agent-browser v1.0.0
Bun v1.1.0
Patchright v1.55.1
```

---

## 5. Skill 定义

### 5.1 Skill 文件

**路径**: `~/.claude/skills/hyper-agent-browser/skill.md` 或项目内 `skills/hyper-browser.md`

```markdown
# hyper-browser

Control web browsers through CLI commands for automation tasks.

## Overview

hyper-agent-browser (hab) is a browser automation CLI that lets you:
- Navigate web pages
- Interact with elements (click, fill, type)
- Extract page information via snapshots
- Maintain login sessions across invocations

## Core Workflow

1. **Open a page**: `hab open <url>`
2. **Get snapshot**: `hab snapshot -i` to see interactive elements
3. **Analyze snapshot**: Find target element references (@e1, @e2, etc.)
4. **Execute action**: `hab click @e5` or `hab fill @e3 "text"`
5. **Repeat** until task is complete

## Commands Quick Reference

### Navigation
- `hab open <url>` - Open URL
- `hab reload` - Refresh page
- `hab back` / `hab forward` - Navigate history

### Actions
- `hab click <selector>` - Click element
- `hab fill <selector> <value>` - Fill input (clears first)
- `hab type <selector> <text>` - Type text (no clear)
- `hab press <key>` - Press key (Enter, Tab, Escape, etc.)
- `hab scroll down|up` - Scroll page
- `hab hover <selector>` - Hover over element
- `hab select <selector> <value>` - Select dropdown option
- `hab wait <ms|selector=...>` - Wait for condition

### Information
- `hab snapshot -i` - Get interactive elements (MOST IMPORTANT)
- `hab screenshot` - Take screenshot
- `hab url` - Get current URL
- `hab title` - Get page title
- `hab content` - Get page text

### Session
- `hab --session <name> <cmd>` - Use named session
- `hab sessions` - List sessions
- `hab close` - Close browser

## Selector Format

- `@e1`, `@e2`, ... - Element references from snapshot (preferred)
- `css=.class` - CSS selector
- `text=Click me` - Text content match
- `xpath=//button` - XPath

## Examples

### Login to a website
```bash
hab --headed -s mysite open https://example.com/login
hab snapshot -i
# Output shows: @e3 [textbox] "Email", @e4 [textbox] "Password", @e5 [button] "Sign in"
hab fill @e3 "user@example.com"
hab fill @e4 "password123"
hab click @e5
hab wait navigation
hab snapshot -i
# Verify login success
```

### Search on Google
```bash
hab open https://google.com
hab snapshot -i
# Output: @e1 [textbox] "Search"
hab fill @e1 "bun javascript runtime"
hab press Enter
hab wait "selector=.g"
hab snapshot -i
```

### Scrape data
```bash
hab -s scraper open https://news.ycombinator.com
hab snapshot -i
# Analyze elements, identify article links
hab content --selector ".titleline"
```

## Tips

1. **Always use `--headed` for debugging** - See what's happening
2. **Use sessions for login persistence** - `hab -s gmail open ...`
3. **Get snapshot before each action** - Page may have changed
4. **Use `@eN` selectors** - More reliable than CSS/XPath
5. **Wait after navigation** - `hab wait navigation` or `hab wait 2000`
```

### 5.2 Skill 使用方式

Agent 通过 Bash 工具调用 CLI：

```typescript
// Agent 内部流程示例
const url = "https://mail.google.com";

// 1. 打开页面
await bash(`hab -s gmail --headed open ${url}`);

// 2. 获取快照
const snapshot = await bash(`hab -s gmail snapshot -i`);

// 3. Agent 分析快照，决定下一步
// 假设找到登录按钮是 @e5
await bash(`hab -s gmail click @e5`);

// 4. 等待并获取新快照
await bash(`hab -s gmail wait 2000`);
const newSnapshot = await bash(`hab -s gmail snapshot -i`);

// 5. 继续循环...
```

---

## 6. 配置系统

### 6.1 配置文件

**路径**: `~/.hab/config.json`

```json
{
  "version": "1.0",
  "defaults": {
    "session": "default",
    "headed": false,
    "channel": "chrome",
    "timeout": 30000
  },
  "sessions": {
    "dataDir": "~/.hab/sessions"
  },
  "browser": {
    "args": [
      "--disable-blink-features=AutomationControlled"
    ],
    "ignoreDefaultArgs": ["--enable-automation"]
  },
  "snapshot": {
    "interactiveRoles": [
      "button", "link", "textbox", "checkbox", 
      "radio", "combobox", "menuitem", "tab"
    ]
  }
}
```

### 6.2 环境变量

| 变量 | 描述 | 示例 |
|------|------|------|
| `HAB_CONFIG` | 配置文件路径 | `~/.hab/config.json` |
| `HAB_SESSION` | 默认 Session | `default` |
| `HAB_HEADED` | 默认显示浏览器 | `true` |
| `HAB_CHANNEL` | 浏览器通道 | `chrome` |
| `HAB_TIMEOUT` | 默认超时 | `30000` |
| `HAB_DEBUG` | 调试模式 | `true` |

### 6.3 配置优先级

```
命令行参数 > 环境变量 > 配置文件 > 默认值
```

---

## 7. 数据结构

### 7.1 Session

```typescript
interface Session {
  name: string;
  status: 'running' | 'stopped';
  channel: 'chrome' | 'msedge' | 'chromium';
  userDataDir: string;
  url?: string;
  title?: string;
  pid?: number;           // 浏览器进程 ID
  wsEndpoint?: string;    // WebSocket 端点（用于重连）
  createdAt: number;
  lastActiveAt: number;
}
```

**存储路径**: `~/.hab/sessions/<session-name>/`

```
~/.hab/sessions/gmail/
├── userdata/           # Chrome UserData
│   ├── Default/
│   │   ├── Cookies
│   │   ├── Local Storage/
│   │   └── ...
└── session.json        # Session 元数据
```

### 7.2 Snapshot

```typescript
interface Snapshot {
  url: string;
  title: string;
  timestamp: number;
  elements: SnapshotElement[];
}

interface SnapshotElement {
  ref: string;              // @e1, @e2, ...
  role: string;             // button, textbox, link, ...
  name: string;             // 可访问名称
  value?: string;           // 当前值
  description?: string;
  checked?: boolean;        // checkbox/radio
  selected?: boolean;       // option
  disabled?: boolean;
  focused?: boolean;
  required?: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### 7.3 CLI 输出格式

**成功输出**:
```
Opened: https://google.com
```

**快照输出**:
```
URL: https://google.com
Title: Google

Interactive Elements:
@e1  [textbox]   "Search" (focused)
@e2  [button]    "Google Search"
@e3  [button]    "I'm Feeling Lucky"
@e4  [link]      "Gmail"
@e5  [link]      "Images"
```

**错误输出**:
```
Error: Element not found: @e99
  Hint: Run 'hab snapshot -i' to see available elements
```

---

## 8. 错误处理

### 8.1 错误类型

```typescript
class HBAError extends Error {
  code: string;
  hint?: string;
}

// 具体错误
class SessionNotFoundError extends HBAError {
  code = 'SESSION_NOT_FOUND';
  hint = "Run 'hab sessions' to see available sessions";
}

class ElementNotFoundError extends HBAError {
  code = 'ELEMENT_NOT_FOUND';
  hint = "Run 'hab snapshot -i' to see available elements";
}

class BrowserNotRunningError extends HBAError {
  code = 'BROWSER_NOT_RUNNING';
  hint = "Run 'hab open <url>' first";
}

class TimeoutError extends HBAError {
  code = 'TIMEOUT';
  hint = "Increase timeout with --timeout option";
}

class NavigationError extends HBAError {
  code = 'NAVIGATION_FAILED';
}

class SelectorError extends HBAError {
  code = 'INVALID_SELECTOR';
  hint = "Use @eN, css=..., text=..., or xpath=...";
}
```

### 8.2 错误输出格式

```bash
$ hab click @e99
Error: Element not found: @e99
  Hint: Run 'hab snapshot -i' to see available elements
  Code: ELEMENT_NOT_FOUND

$ hab -s nonexistent click @e1
Error: Session 'nonexistent' not found
  Hint: Run 'hab sessions' to see available sessions
  Code: SESSION_NOT_FOUND

$ hab fill @e3 "test"
Error: Browser not running
  Hint: Run 'hab open <url>' first
  Code: BROWSER_NOT_RUNNING
```

### 8.3 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 一般错误 |
| 2 | 参数错误 |
| 3 | Session 错误 |
| 4 | 浏览器错误 |
| 5 | 元素错误 |
| 6 | 超时 |

---

## 9. 安全设计

### 9.1 UserData 隔离

```bash
# 每个 Session 独立的 UserData 目录
~/.hab/sessions/
├── default/userdata/    # 默认 Session
├── gmail/userdata/      # Gmail Session
├── github/userdata/     # GitHub Session
└── ...

# 权限
chmod 700 ~/.hab/sessions/
```

### 9.2 Evaluate 安全限制

```typescript
// 默认禁止危险操作
const FORBIDDEN_PATTERNS = [
  /require\s*\(/,
  /import\s*\(/,
  /process\./,
  /child_process/,
  /fs\./,
  /__dirname/,
  /__filename/,
];

function safeEvaluate(script: string): void {
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(script)) {
      throw new Error('Potentially unsafe script blocked');
    }
  }
}
```

### 9.3 反检测

Patchright 内置反检测：
- 隐藏 `navigator.webdriver`
- 修复 `navigator.plugins`
- 伪造 `navigator.languages`
- 移除自动化标记

---

## 10. 性能

### 10.1 启动时间

| 操作 | 时间 |
|------|------|
| CLI 冷启动 | ~25ms |
| 连接已有浏览器 | ~50ms |
| 首次启动浏览器 | ~1-2s |
| 执行简单命令 | ~100ms |
| 获取快照 | ~200-500ms |

### 10.2 浏览器复用

```typescript
// 使用 wsEndpoint 重连已有浏览器
async function connectOrLaunch(session: Session) {
  if (session.wsEndpoint) {
    try {
      return await chromium.connect(session.wsEndpoint);
    } catch {
      // 浏览器已关闭，重新启动
    }
  }
  
  return await chromium.launchPersistentContext(
    session.userDataDir,
    { channel: session.channel }
  );
}
```

### 10.3 单文件编译

```bash
# 编译成 ~50MB 单文件
bun build --compile --minify src/cli.ts --outfile dist/hab

# 跨平台
bun build --compile --target=bun-darwin-arm64 src/cli.ts --outfile dist/hab-macos-arm64
bun build --compile --target=bun-linux-x64 src/cli.ts --outfile dist/hab-linux-x64
bun build --compile --target=bun-windows-x64 src/cli.ts --outfile dist/hab-windows.exe
```

---

## 11. 测试

### 11.1 单元测试

```typescript
// tests/unit/selector.test.ts
import { describe, it, expect } from 'bun:test';
import { parseSelector } from '../../src/utils/selector';

describe('parseSelector', () => {
  it('should parse element reference', () => {
    const result = parseSelector('@e5');
    expect(result).toEqual({ type: 'ref', value: 'e5' });
  });

  it('should parse CSS selector', () => {
    const result = parseSelector('css=.btn');
    expect(result).toEqual({ type: 'css', value: '.btn' });
  });

  it('should parse text selector', () => {
    const result = parseSelector('text=Login');
    expect(result).toEqual({ type: 'text', value: 'Login' });
  });
});
```

### 11.2 集成测试

```typescript
// tests/integration/cli.test.ts
import { describe, it, expect } from 'bun:test';
import { $ } from 'bun';

describe('CLI', () => {
  it('should show help', async () => {
    const result = await $`bun run src/cli.ts --help`.text();
    expect(result).toContain('Usage:');
  });

  it('should open URL', async () => {
    const result = await $`bun run src/cli.ts -s test open https://example.com`.text();
    expect(result).toContain('Opened:');
    
    // Cleanup
    await $`bun run src/cli.ts -s test close`.quiet();
  });
});
```

### 11.3 运行测试

```bash
bun test                    # 运行所有测试
bun test tests/unit         # 只运行单元测试
bun test --watch            # 监听模式
bun test --coverage         # 覆盖率
```

---

## 12. 构建与分发

### 12.1 开发模式

```bash
# 直接运行（无需编译）
bun run src/cli.ts open https://google.com

# 使用 package.json script
bun dev -- open https://google.com
```

### 12.2 构建

```bash
# 当前平台
bun run build

# 所有平台
bun run build:all
```

### 12.3 安装方式

```bash
# 方式 1: npm/bun 全局安装
bun add -g hyper-agent-browser

# 方式 2: 下载编译好的二进制
curl -fsSL https://github.com/.../releases/download/v1.0.0/hab-darwin-arm64 -o /usr/local/bin/hab
chmod +x /usr/local/bin/hab

# 方式 3: Homebrew (macOS)
brew install hyper-agent-browser
```

---

## 13. 版本路线

| 版本 | 功能 |
|------|------|
| 0.1.0 | 基础命令: open, click, fill, snapshot, close |
| 0.2.0 | 完整命令: type, press, scroll, wait, hover, select |
| 0.3.0 | Session 持久化 + 浏览器复用 |
| 0.4.0 | 配置系统 + 错误处理优化 |
| 0.5.0 | 单文件分发 + 跨平台构建 |
| 1.0.0 | 稳定版 + Skill 文档 |

---

## 14. 附录

### 14.1 参考项目

| 项目 | 参考点 |
|------|--------|
| [agent-browser](https://github.com/anthropics/agent-browser) | CLI 设计、快照格式 |
| [playwright-mcp](https://github.com/anthropics/playwright-mcp) | MCP 集成思路 |
| [Patchright](https://github.com/nicholascelestin/patchright) | 反检测实现 |

### 14.2 术语表

| 术语 | 定义 |
|------|------|
| Session | 隔离的浏览器实例，包含独立的 UserData |
| UserData | Chrome 用户数据目录，包含 Cookies、LocalStorage 等 |
| Snapshot | 页面可访问性树的结构化表示 |
| Element Reference | 快照中的元素引用，如 @e1, @e2 |
| Patchright | Playwright 的反检测 fork |

### 14.3 常见问题

**Q: 如何保持登录状态？**
A: 使用命名 Session：`hab -s gmail open https://mail.google.com`，登录后关闭，下次使用同一 Session 即可。

**Q: 如何处理验证码/人机验证？**
A: 使用 `--headed` 模式手动处理，或使用第三方验证码服务。

**Q: 支持多标签页吗？**
A: 当前版本只支持单标签页。多标签页支持计划在 v1.1。

**Q: 快照太大怎么办？**
A: 使用 `-i` 只获取可交互元素，或使用 `--selector` 限定范围。

---

**文档版本**: 1.0.0-spec  
**技术栈**: Bun + Patchright + Commander.js  
**最后更新**: 2026-01-15
