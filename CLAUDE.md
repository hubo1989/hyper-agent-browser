# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**hyperagentbrowser (hba)** - 纯浏览器操作 CLI 工具，供 AI Agent 调用

核心理念：将 AI 决策与浏览器操作分离。CLI 负责确定性的浏览器操作，AI Agent 负责任务理解和决策。

## 技术栈

- **运行时**: Bun (>= 1.1.0)
- **浏览器驱动**: Patchright ^1.55.1 (反检测 Playwright fork)
- **CLI 框架**: Commander.js ^12.0.0
- **验证**: Zod ^3.24.0
- **代码规范**: @biomejs/biome (替代 ESLint + Prettier)

## 开发命令

```bash
# 开发模式运行
bun run src/cli.ts <command> [options]
bun dev -- <command> [options]

# 测试
bun test                    # 运行所有测试
bun test tests/unit         # 单元测试
bun test tests/integration  # 集成测试
bun test --watch            # 监听模式
bun test --coverage         # 覆盖率

# 代码规范
bunx @biomejs/biome check .         # 检查
bunx @biomejs/biome check --write . # 修复
bunx tsc --noEmit                   # 类型检查

# 构建
bun run build       # 当前平台单文件编译
bun run build:all   # 所有平台构建
```

## 核心架构

### 模块划分

```
src/
├── cli.ts                 # CLI 入口，Commander 定义
├── browser/
│   ├── manager.ts         # 浏览器生命周期管理
│   └── context.ts         # BrowserContext 封装
├── session/
│   ├── manager.ts         # Session 管理（多浏览器实例隔离）
│   └── store.ts           # UserData 持久化
├── commands/
│   ├── navigation.ts      # open/reload/back/forward
│   ├── actions.ts         # click/fill/type/press/scroll
│   ├── info.ts            # snapshot/screenshot/evaluate/url/title
│   └── session.ts         # sessions/close
├── snapshot/
│   ├── accessibility.ts   # 从可访问性树提取元素
│   └── formatter.ts       # 格式化输出（@e1, @e2 引用）
└── utils/
    ├── selector.ts        # 选择器解析（@e1/css=/text=/xpath=）
    ├── config.ts          # 配置管理（~/.hba/config.json）
    └── logger.ts          # 日志
```

### 进程模型

**单次执行模型**: 每次 CLI 调用是独立进程，但浏览器实例持久化复用

```
1. CLI 进程启动（~25ms Bun 启动）
2. 加载 Session 配置
3. 连接/启动浏览器（launchPersistentContext）
4. 执行命令
5. 输出结果
6. 保持浏览器运行（供下次复用）
7. CLI 进程退出
```

### Session 隔离

每个 Session 有独立的 UserData 目录（Cookies/LocalStorage/登录状态）：

```
~/.hba/sessions/
├── default/
│   ├── userdata/      # Chrome UserData
│   └── session.json   # 元数据（wsEndpoint/pid/url）
├── gmail/
└── github/
```

## 关键设计决策

### 1. Snapshot 系统（核心功能）

通过可访问性树（Accessibility Tree）提取页面元素，生成 `@e1`, `@e2` 等引用：

```bash
$ hba snapshot -i
URL: https://google.com
Title: Google

Interactive Elements:
@e1  [textbox]   "Search" (focused)
@e2  [button]    "Google Search"
@e3  [button]    "I'm Feeling Lucky"
```

**实现要点**:
- 使用 Patchright 的 `page.accessibility.snapshot()`
- 过滤可交互角色（button/link/textbox/checkbox 等）
- 为每个元素生成稳定引用（@eN）
- 记录 role/name/value/state/boundingBox

### 2. 选择器解析

支持 4 种选择器格式：
- `@e1` - 快照引用（推荐，AI Agent 使用）
- `css=.btn` - CSS 选择器
- `text=登录` - 文本匹配
- `xpath=//button` - XPath

### 3. 浏览器复用策略

使用 `launchPersistentContext` + `wsEndpoint` 重连：

```typescript
// 伪代码
if (session.wsEndpoint && isBrowserRunning(session.pid)) {
  context = await chromium.connect(session.wsEndpoint);
} else {
  context = await chromium.launchPersistentContext(
    session.userDataDir,
    { channel: 'chrome', headless: !headed }
  );
  session.wsEndpoint = context.wsEndpoint();
}
```

### 4. 反检测配置

Patchright 内置反检测，额外配置：

```typescript
{
  args: ['--disable-blink-features=AutomationControlled'],
  ignoreDefaultArgs: ['--enable-automation']
}
```

## AI Agent 集成模式

Agent 通过 Bash 工具循环调用 CLI：

```typescript
// 示例流程
await bash(`hba -s gmail open https://mail.google.com`);
const snapshot = await bash(`hba -s gmail snapshot -i`);
// Agent 分析 snapshot，找到元素 @e5
await bash(`hba -s gmail click @e5`);
await bash(`hba -s gmail wait 2000`);
// 循环直到任务完成
```

## 错误处理规范

- 使用自定义错误类（继承 Error，包含 code 和 hint）
- 提供友好的错误提示（引导用户下一步操作）
- 标准退出码：0=成功, 1=一般错误, 2=参数错误, 3=Session错误, 4=浏览器错误, 5=元素错误, 6=超时

```typescript
class ElementNotFoundError extends HBAError {
  code = 'ELEMENT_NOT_FOUND';
  hint = "Run 'hba snapshot -i' to see available elements";
}
```

## 性能目标

- CLI 冷启动: ~25ms
- 连接已有浏览器: ~50ms
- 首次启动浏览器: ~1-2s
- 获取快照: ~200-500ms
- 单文件编译产物: ~50MB

## 配置系统

**优先级**: 命令行参数 > 环境变量 > 配置文件 > 默认值

配置文件位置: `~/.hba/config.json`

环境变量: `HBA_CONFIG`, `HBA_SESSION`, `HBA_HEADED`, `HBA_CHANNEL`, `HBA_TIMEOUT`, `HBA_DEBUG`

## 版本路线

- v0.1: 基础命令（open/click/fill/snapshot/close）
- v0.2: 完整命令（type/press/scroll/wait/hover/select）
- v0.3: Session 持久化 + 浏览器复用
- v0.4: 配置系统 + 错误处理
- v0.5: 单文件分发 + 跨平台构建
- v1.0: 稳定版 + Skill 文档

## 注意事项

- **函数式风格**: 优先使用纯函数，避免类
- **类型安全**: 严格 TypeScript，使用 Zod 验证外部输入
- **进程隔离**: 每次 CLI 调用是新进程，不依赖内存状态
- **安全限制**: evaluate 命令禁止 require/import/process/fs 等危险操作
- **单标签页**: 当前版本只支持单标签页（多标签页计划 v1.1）
