# hyper-agent-browser (hab)

**Pure Browser Automation CLI for AI Agents**

[![npm version](https://img.shields.io/npm/v/hyper-agent-browser.svg)](https://www.npmjs.com/package/hyper-agent-browser)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.1.0-orange.svg)](https://bun.sh)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

> 📖 [中文文档 (Chinese Documentation)](./docs/README_CN.md)

## ✨ Features

- 🎯 **@eN Element References** - No manual selectors needed, auto-generates `@e1`, `@e2` references
- 🔐 **Session Persistence** - Maintains login state, supports multi-account isolation
- 🎭 **Anti-Detection** - Built on Patchright, bypasses automation detection
- ⚡ **Fast Startup** - Bun runtime, cold start ~25ms
- 🤖 **AI Agent Friendly** - Designed for Claude Code and other AI agents
- 🔒 **Security Hardened** - Sandbox isolation, permission control, session protection
- 📊 **Data Extraction** - Auto-extract tables/lists/forms/metadata
- 🌐 **Network Monitoring** - Intercept XHR/Fetch requests, get API data directly
- ⏳ **Smart Waiting** - Network idle + DOM stable dual strategy

## 🚀 Quick Start

### Installation

**Using npm (Recommended)**

```bash
# Global install
npm install -g hyper-agent-browser

# Or use Bun
bun install -g hyper-agent-browser

# Or use npx (no install needed)
npx hyper-agent-browser --version
```

**From Source**

```bash
git clone https://github.com/anthropics/hyper-agent-browser.git
cd hyper-agent-browser
bun install
bun run build  # Build binary to dist/hab
```

**Download Pre-built Binary**

Visit [GitHub Releases](https://github.com/anthropics/hyper-agent-browser/releases) to download binaries for your platform.

### Basic Usage

```bash
# 1. Open a webpage (headed mode to see browser)
hab --headed open https://google.com

# 2. Get interactive elements snapshot
hab snapshot -i

# Output example:
# URL: https://google.com
# Title: Google
#
# Interactive Elements:
# @e1  [textbox]   "Search" (focused)
# @e2  [button]    "Google Search"
# @e3  [button]    "I'm Feeling Lucky"
# @e4  [link]      "Gmail"
# @e5  [link]      "Images"

# 3. Use @eN references to interact
hab fill @e1 "Bun JavaScript runtime"
hab press Enter

# 4. Wait for page load
hab wait 2000

# 5. Take screenshot
hab screenshot -o result.png
```

### Session Management (Multi-Account Isolation)

```bash
# Personal Gmail account
hab -s personal-gmail open https://mail.google.com
hab -s personal-gmail snapshot -i

# Work Gmail account
hab -s work-gmail open https://mail.google.com
hab -s work-gmail snapshot -i

# List all sessions
hab sessions

# Close specific session
hab close -s personal-gmail
```

### Data Extraction

```bash
# Extract table data
hab open https://example.com/users
hab extract-table > users.json

# Extract list data (auto-detect product/article lists)
hab extract-list --selector ".product-list" > products.json

# Extract form state
hab extract-form > form_data.json

# Extract page metadata (SEO/OG/Schema.org)
hab extract-meta --include seo,og > metadata.json
```

### Network Monitoring

```bash
# Start network listener
LISTENER_ID=$(hab network-start --filter xhr,fetch --url-pattern "*/api/*" | jq -r '.listenerId')

# Perform actions (pagination/clicks)
hab click @e5
hab wait-idle

# Stop listener and get all API data
hab network-stop $LISTENER_ID > api_data.json
```

### Smart Waiting

```bash
# Wait for page fully idle (network + DOM)
hab wait-idle --timeout 30000

# Wait for element visible
hab wait-element "css=.data-row" --state visible

# Wait for loading animation to disappear
hab wait-element "css=.loading" --state detached
```

## 📖 Command Reference

### Navigation Commands

| Command | Description | Example |
|---------|-------------|---------|
| `open <url>` | Open webpage | `hab open https://example.com` |
| `reload` | Refresh current page | `hab reload` |
| `back` | Go back | `hab back` |
| `forward` | Go forward | `hab forward` |

### Action Commands

| Command | Description | Example |
|---------|-------------|---------|
| `click <selector>` | Click element | `hab click @e1` |
| `fill <selector> <value>` | Fill input field | `hab fill @e1 "hello"` |
| `type <text>` | Type text character by character | `hab type "password"` |
| `press <key>` | Press key | `hab press Enter` |
| `scroll <direction> [amount]` | Scroll page | `hab scroll down 500` |
| `hover <selector>` | Hover over element | `hab hover @e3` |
| `select <selector> <value>` | Select dropdown option | `hab select @e2 "Option 1"` |
| `wait <ms\|condition>` | Wait for time or condition | `hab wait 3000` |

### Info Commands

| Command | Description | Example |
|---------|-------------|---------|
| `snapshot [-i\|--interactive]` | Get page snapshot | `hab snapshot -i` |
| `screenshot [-o <file>] [--full-page]` | Take screenshot | `hab screenshot -o page.png` |
| `url` | Get current URL | `hab url` |
| `title` | Get page title | `hab title` |
| `evaluate <script>` | Execute JavaScript | `hab evaluate "document.title"` |

### Session Commands

| Command | Description | Example |
|---------|-------------|---------|
| `sessions` | List all sessions | `hab sessions` |
| `close [-s <name>]` | Close session | `hab close -s gmail` |

### Global Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --session <name>` | Session name | `default` |
| `--headed` | Headed mode (show browser) | `false` |
| `--channel <chrome\|msedge>` | Browser type | `chrome` |
| `--timeout <ms>` | Timeout | `30000` |

## 🤖 AI Agent Integration (Claude Code)

hyper-agent-browser is designed for AI agents and integrates seamlessly with Claude Code.

### Install Skill File

```bash
# Method 1: Copy from local repo
mkdir -p ~/.claude/skills/hyper-agent-browser
cp skills/hyper-agent-browser.md ~/.claude/skills/hyper-agent-browser/skill.md

# Method 2: Direct download
mkdir -p ~/.claude/skills/hyper-agent-browser
curl -o ~/.claude/skills/hyper-agent-browser/skill.md \
  https://raw.githubusercontent.com/anthropics/hyper-agent-browser/main/skills/hyper-agent-browser.md
```

### Usage Examples

After installing the skill, Claude Code will automatically recognize and use `hab` commands:

```
"Help me open Google, search for 'Bun runtime' and take a screenshot"
"Log into my Gmail account and find the number of unread emails"
"Visit Twitter and get all tweet titles from the homepage"
```

Claude will automatically:
1. Use `hab open` to open the webpage
2. Use `hab snapshot -i` to get element references
3. Analyze the snapshot to find target elements (e.g., `@e5`)
4. Use `hab click @e5` and other commands to complete the task

## 📋 Selector Format

| Format | Example | Description | Recommended |
|--------|---------|-------------|-------------|
| `@eN` | `@e1`, `@e5` | Element reference (from snapshot) | ⭐⭐⭐⭐⭐ |
| `css=` | `css=#login` | CSS selector | ⭐⭐⭐ |
| `text=` | `text=Sign in` | Text match | ⭐⭐⭐⭐ |
| `xpath=` | `xpath=//button` | XPath selector | ⭐⭐ |

**Recommended: Use `@eN` references**:
- No manual selector writing
- Auto-handles dynamic IDs/Classes
- AI Agent friendly

## 🔒 Security Features

- ✅ **evaluate Sandbox** - Whitelist mode, blocks dangerous operations
- ✅ **Session File Protection** - Permissions set to `0o600`
- ✅ **Chrome Extension Verification** - Whitelist + dangerous permission filtering
- ✅ **System Keychain Isolation** - Isolated password storage by default
- ✅ **Config Key Whitelist** - Prevents dangerous browser argument injection

## 🏗️ Architecture

```
src/
├── cli.ts              # CLI entry (Commander.js)
├── browser/
│   └── manager.ts      # Browser lifecycle management
├── daemon/
│   ├── server.ts       # Daemon server
│   ├── client.ts       # Daemon client
│   └── browser-pool.ts # Browser instance pool
├── session/
│   ├── manager.ts      # Session management
│   └── store.ts        # UserData persistence
├── commands/
│   ├── navigation.ts   # open/reload/back/forward
│   ├── actions.ts      # click/fill/type/press/scroll
│   ├── info.ts         # snapshot/screenshot/evaluate
│   ├── extract.ts      # Data extraction commands
│   └── network.ts      # Network monitoring
├── snapshot/
│   ├── accessibility.ts    # Extract from Accessibility Tree
│   ├── dom-extractor.ts    # DOM extractor (fallback)
│   └── reference-store.ts  # @eN mapping storage
└── utils/
    ├── selector.ts     # Selector parsing
    ├── config.ts       # Config management
    └── errors.ts       # Error handling
```

## 📊 Tech Stack

- **Bun** 1.2.21 - JavaScript runtime
- **Patchright** 1.57.0 - Anti-detection Playwright fork
- **Commander.js** 12.1.0 - CLI framework
- **Zod** 3.25.76 - Data validation
- **Biome** 1.9.4 - Code linting

## 🛠️ Development

```bash
# Clone repo
git clone https://github.com/anthropics/hyper-agent-browser.git
cd hyper-agent-browser

# Install dependencies
bun install

# Development mode
bun dev -- --headed open https://google.com

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint

# Build
bun run build       # Current platform
bun run build:all   # All platforms
```

## 📚 Documentation

- [Quick Start Guide](./GETTING_STARTED.md)
- [Element Reference Guide](./ELEMENT_REFERENCE_GUIDE.md)
- [Google Profile Integration](./GOOGLE_PROFILE_GUIDE.md)
- [Developer Docs](./CLAUDE.md)
- [Technical Spec](./hyper-agent-browser-spec.md)
- [Skill Documentation](./skills/hyper-agent-browser.md)
- [中文文档 (Chinese)](./docs/README_CN.md)

## 🤝 Contributing

Pull Requests welcome! Please ensure:

- ✅ TypeScript type check passes: `bun run typecheck`
- ✅ Tests pass: `bun test`
- ✅ Lint passes: `bun run lint`

## 📄 License

[MIT](./LICENSE)

## 🔗 Links

- **npm**: https://www.npmjs.com/package/hyper-agent-browser
- **GitHub**: https://github.com/anthropics/hyper-agent-browser
- **Issues**: https://github.com/anthropics/hyper-agent-browser/issues
- **Releases**: https://github.com/anthropics/hyper-agent-browser/releases

## 🙏 Acknowledgments

- [Patchright](https://github.com/Patchright/patchright) - Anti-detection Playwright fork
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Claude Code](https://claude.ai/code) - AI programming assistant

---

**Made with ❤️ for AI Agents**
