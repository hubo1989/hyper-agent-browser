# HBA (HyperAgentBrowser) - Browser Automation Skill

## Skill Overview

HBA 是纯浏览器操作 CLI 工具，用于 AI Agent 执行确定性的浏览器自动化任务。核心理念：AI 负责决策，hab 负责执行。

## Installation & Setup

```bash
# 安装依赖
cd /Users/hubo/mycode/hyper-agent-browser
bun install

# 首次使用前检测可用浏览器
```

## Browser Detection & Selection

在首次使用 hab 前，必须检测系统可用的浏览器并选择合适的 channel。

### Step 1: 检测系统浏览器

```bash
# macOS
ls -la "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" 2>/dev/null && echo "Chrome: ✓" || echo "Chrome: ✗"
ls -la "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" 2>/dev/null && echo "Edge: ✓" || echo "Edge: ✗"

# Linux
which google-chrome chromium-browser microsoft-edge 2>/dev/null

# Windows (PowerShell)
Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### Step 2: 选择 Channel 优先级

根据检测结果，按以下优先级选择：

1. **chrome** (推荐) - 最广泛使用，扩展生态最完善
2. **msedge** - 基于 Chromium，兼容性好
3. **chromium** - 开源版本，Patchright 会自动下载（约 150MB）

### Step 3: 设置默认 Channel

```bash
# 如果系统有 Chrome
bun run src/cli.ts config set channel chrome

# 如果只有 Edge
bun run src/cli.ts config set channel msedge

# 如果都没有（自动下载 Chromium）
bun run src/cli.ts config set channel chromium
```

### Step 4: 验证浏览器可用性

```bash
# 测试打开浏览器（会自动启动 daemon）
bun run src/cli.ts open https://example.com --headed

# 检查是否成功
bun run src/cli.ts url
```

## Core Usage Pattern

### 标准工作流程

```bash
# 1. 打开页面（首次会自动启动 daemon）
bun run src/cli.ts open <url> [--headed]

# 2. 获取页面快照（核心功能）
bun run src/cli.ts snapshot -i

# 3. 分析快照，找到目标元素（AI 决策）
# 例如输出: @e5 [button] "登录"

# 4. 执行操作
bun run src/cli.ts click @e5
bun run src/cli.ts fill @e10 "username"
bun run src/cli.ts type @e11 "password"

# 5. 循环执行 snapshot → 分析 → 操作，直到任务完成
```

### Session 管理

每个 session 有独立的浏览器状态（Cookies/LocalStorage/登录状态）：

```bash
# 使用不同 session 隔离不同账号
bun run src/cli.ts -s gmail open https://mail.google.com
bun run src/cli.ts -s github open https://github.com
bun run src/cli.ts -s default open https://x.com

# 查看所有 session
bun run src/cli.ts sessions

# 关闭 session（关闭浏览器但保留数据）
bun run src/cli.ts -s gmail close
```

### Daemon 管理

```bash
# 手动管理 daemon（通常不需要，会自动启动）
bun run src/cli.ts daemon start   # 启动
bun run src/cli.ts daemon stop    # 停止（关闭所有浏览器）
bun run src/cli.ts daemon status  # 状态
bun run src/cli.ts daemon restart # 重启
```

## Command Reference

### Navigation

```bash
# 打开 URL
bun run src/cli.ts open <url> [--wait-until load|domcontentloaded|networkidle]

# 刷新
bun run src/cli.ts reload

# 前进/后退
bun run src/cli.ts back
bun run src/cli.ts forward
```

### Actions

```bash
# 点击元素
bun run src/cli.ts click <selector>

# 填充输入框（清空后填入）
bun run src/cli.ts fill <selector> <value>

# 逐字输入（模拟键盘）
bun run src/cli.ts type <selector> <text> [--delay <ms>]

# 按键
bun run src/cli.ts press <key>  # Enter, Escape, ArrowDown, etc.

# 滚动
bun run src/cli.ts scroll up|down|left|right [--amount <pixels>] [--selector <sel>]

# 悬停
bun run src/cli.ts hover <selector>

# 下拉选择
bun run src/cli.ts select <selector> <value>

# 等待
bun run src/cli.ts wait <condition>  # 数字(ms), selector=..., hidden=..., navigation
```

### Information

```bash
# 获取快照（核心）
bun run src/cli.ts snapshot -i          # 仅交互元素（推荐）
bun run src/cli.ts snapshot -f          # 所有元素
bun run src/cli.ts snapshot -r          # 原始 JSON
bun run src/cli.ts snapshot -o out.txt  # 保存到文件

# 截图
bun run src/cli.ts screenshot [-o file.png] [--full-page] [--selector <sel>]

# 执行 JavaScript
bun run src/cli.ts evaluate "document.title"

# 获取基本信息
bun run src/cli.ts url
bun run src/cli.ts title
```

## Selector Types

hab 支持 4 种选择器格式：

1. **@e1** - 快照引用（推荐，AI 使用）
   ```bash
   bun run src/cli.ts snapshot -i
   # 输出: @e5 [button] "登录"
   bun run src/cli.ts click @e5
   ```

2. **css=** - CSS 选择器
   ```bash
   bun run src/cli.ts click "css=.btn-primary"
   ```

3. **text=** - 文本匹配
   ```bash
   bun run src/cli.ts click "text=登录"
   ```

4. **xpath=** - XPath
   ```bash
   bun run src/cli.ts click "xpath=//button[text()='登录']"
   ```

## Best Practices for AI Agents

### 1. 始终使用 snapshot 定位元素

**错误示例（不要这样做）：**
```bash
# ❌ 直接假设元素存在
bun run src/cli.ts click "css=#login-button"
```

**正确示例：**
```bash
# ✅ 先获取 snapshot，确认元素存在
bun run src/cli.ts snapshot -i
# 分析输出，找到 @e10 [button] "登录"
bun run src/cli.ts click @e10
```

### 2. 操作后等待页面稳定

```bash
# ✅ 点击后等待页面跳转
bun run src/cli.ts click @e5
bun run src/cli.ts wait navigation

# ✅ 或等待特定元素出现
bun run src/cli.ts click @e5
bun run src/cli.ts wait "selector=.success-message"
```

### 3. 验证操作结果

```bash
# ✅ 填写表单后验证
bun run src/cli.ts fill @e10 "username"
bun run src/cli.ts snapshot -i
# 确认输入框有值再继续
```

### 4. 处理登录状态

首次访问需要人工登录的网站：

```bash
# 1. 打开有头浏览器，等待人工登录
bun run src/cli.ts open https://x.com --headed
bun run src/cli.ts wait 60000  # 等待 60 秒人工登录

# 2. 验证登录成功
bun run src/cli.ts snapshot -i | grep -i "发帖\|timeline\|home"

# 3. 后续命令自动继承登录状态（session 持久化）
bun run src/cli.ts open https://x.com  # 无需再次登录
```

### 5. 使用 session 隔离不同账号

```bash
# ✅ 多账号场景使用不同 session
bun run src/cli.ts -s work_gmail open https://mail.google.com
bun run src/cli.ts -s personal_gmail open https://mail.google.com
```

## Error Handling

### 常见错误和解决方案

**1. 浏览器不可用**
```
Error: Executable doesn't exist at /Applications/Google Chrome.app
```
解决：执行浏览器检测流程，切换到可用的 channel

**2. 元素未找到**
```
Error: Element not found: @e99
```
解决：重新获取 snapshot，元素引用可能已过期（页面更新后）

**3. Session 冲突（已修复）**
```
Error: Profile is already in use
```
解决：此问题已通过 daemon 架构解决，无需处理

**4. 超时错误**
```
Error: Timeout 30000ms exceeded
```
解决：增加 timeout 或分步等待
```bash
bun run src/cli.ts -t 60000 open https://slow-site.com
```

### 错误恢复策略

```bash
# 如果 daemon 异常，重启即可
bun run src/cli.ts daemon restart

# 如果 session 损坏，删除重建
rm -rf ~/.hab/sessions/default
bun run src/cli.ts open https://example.com
```

## Environment Variables

```bash
# 开启扩展加载（实验性，可能不稳定）
export HAB_LOAD_EXTENSIONS=true

# 同步系统 Chrome 数据（有限效果，Keychain 加密问题）
export HAB_SYNC_CHROME=true

# 调试模式
export HAB_DEBUG=true
```

## Advanced Scenarios

### 提取动态内容

```bash
# 1. 滚动加载更多内容
bun run src/cli.ts scroll down --amount 1000
bun run src/cli.ts wait 2000

# 2. 执行 JavaScript 提取数据
bun run src/cli.ts evaluate "Array.from(document.querySelectorAll('.post')).map(p => p.textContent).slice(0, 3).join('\n---\n')"
```

### 多步骤表单填写

```bash
# 1. 获取表单结构
bun run src/cli.ts snapshot -i

# 2. 填写第一页
bun run src/cli.ts fill @e5 "John Doe"
bun run src/cli.ts fill @e6 "john@example.com"
bun run src/cli.ts click @e10  # 下一步

# 3. 等待第二页加载
bun run src/cli.ts wait navigation
bun run src/cli.ts snapshot -i

# 4. 填写第二页
bun run src/cli.ts fill @e3 "123 Main St"
bun run src/cli.ts click @e8  # 提交
```

### 处理弹窗和对话框

```bash
# 1. 点击触发弹窗
bun run src/cli.ts click @e15

# 2. 等待弹窗元素出现
bun run src/cli.ts wait "selector=.modal"

# 3. 获取弹窗内元素
bun run src/cli.ts snapshot -i

# 4. 操作弹窗内元素
bun run src/cli.ts click @e20  # 确认按钮
```

## Limitations

1. **单标签页限制** - 当前版本只支持单个标签页操作（多标签页计划 v1.1）
2. **文件下载** - 不支持处理文件下载对话框
3. **iframe** - snapshot 不会自动进入 iframe 内部
4. **Shadow DOM** - 需要使用 CSS 选择器的 `>>>` 穿透语法
5. **登录状态继承** - 无法直接继承系统浏览器登录状态（需要手动登录一次）

## Performance Tips

- CLI 冷启动: ~25ms
- 连接已有浏览器: ~50ms
- 获取快照: ~200-500ms
- daemon 自动管理浏览器复用，无需手动优化

## Troubleshooting

### Daemon 无法启动
```bash
# 检查端口占用
lsof -i :9527

# 查看 daemon 日志
cat ~/.hab/daemon.log

# 手动清理
rm ~/.hab/daemon.pid ~/.hab/daemon.json
bun run src/cli.ts daemon start
```

### 浏览器进程泄漏
```bash
# 查找 Chrome 进程
ps aux | grep Chrome

# 强制清理
bun run src/cli.ts daemon stop
killall "Google Chrome" "Microsoft Edge" "Chromium"
```

### Session 数据损坏
```bash
# 备份旧数据
mv ~/.hab/sessions/default ~/.hab/sessions/default.bak

# 重建 session
bun run src/cli.ts open https://example.com
```

## Example: Complete Task Workflow

**任务：获取 X.com 首页最热门的 3 个帖子**

```bash
# 1. 浏览器检测（首次使用）
ls -la "/Applications/Google Chrome.app" && \
bun run src/cli.ts config set channel chrome

# 2. 打开 X.com（有头模式，等待人工登录）
bun run src/cli.ts -s twitter open https://x.com --headed
bun run src/cli.ts wait 60000  # 等待人工登录

# 3. 验证登录状态
bun run src/cli.ts snapshot -i | grep -i "home\|timeline"

# 4. 关闭有头浏览器，切换无头模式继续
bun run src/cli.ts -s twitter open https://x.com

# 5. 等待 timeline 加载
bun run src/cli.ts wait "selector=[data-testid='primaryColumn']"

# 6. 执行 JavaScript 提取前 3 个帖子
bun run src/cli.ts evaluate "
  Array.from(document.querySelectorAll('[data-testid=\"tweet\"]'))
    .slice(0, 3)
    .map((tweet, i) => {
      const text = tweet.querySelector('[data-testid=\"tweetText\"]')?.textContent || '';
      const metrics = tweet.querySelector('[role=\"group\"]')?.textContent || '';
      return \`Post \${i+1}:\n\${text}\n\${metrics}\`;
    })
    .join('\n\n---\n\n')
"

# 7. 完成后可选关闭
bun run src/cli.ts -s twitter close
```

## Summary

HBA 作为 Agent 工具的核心优势：
- **确定性执行** - 浏览器操作可靠，AI 只需关注决策
- **Session 隔离** - 多账号、多任务互不干扰
- **快照驱动** - 通过 @e 引用精确定位元素
- **持久化状态** - 登录状态自动保存，无需重复登录
- **Daemon 架构** - 浏览器复用，性能优异

使用原则：先检测浏览器 → 选择 channel → snapshot → 分析 → 执行 → 验证 → 循环
