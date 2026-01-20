# Getting Started with hyperagentbrowser

## 前置要求

系统已检测到以下浏览器：
- ✅ Google Chrome
- ✅ Google Chrome Canary
- ✅ Microsoft Edge

## 快速测试

### 1. 测试基本命令（无需浏览器）

```bash
# 查看帮助
bun dev -- --help

# 列出会话
bun dev -- sessions
```

### 2. 测试浏览器启动

```bash
# 使用 Chrome（headless 模式）
bun dev -- open https://example.com

# 使用 Chrome（显示浏览器窗口）
bun dev -- --headed open https://example.com

# 使用 Edge
bun dev -- --channel msedge --headed open https://example.com
```

### 3. 测试基本交互流程

```bash
# 打开 Google
bun dev -- -s test --headed open https://google.com

# 等待加载
bun dev -- -s test wait 2000

# 获取快照（查看可交互元素）
bun dev -- -s test snapshot -i

# 获取当前 URL 和标题
bun dev -- -s test url
bun dev -- -s test title

# 关闭会话
bun dev -- -s test close
```

### 4. 运行示例脚本

```bash
chmod +x examples/google-search.sh
./examples/google-search.sh
```

## 下一步开发任务

1. **实现 @eN 引用映射**
   - 在 snapshot 中收集元素的实际选择器
   - 创建引用到选择器的映射表
   - 在 actions 命令中使用映射

2. **完善 Accessibility API**
   - 测试 Patchright 的 accessibility.snapshot()
   - 如果不可用，实现备选方案（DOM 遍历）

3. **添加集成测试**
   - 测试完整的工作流程
   - 验证 Session 持久化
   - 测试错误处理

4. **优化构建流程**
   - 测试跨平台构建
   - 创建发布流程

## 故障排除

### 浏览器启动失败

如果遇到浏览器启动失败，尝试：

```bash
# 明确指定浏览器
bun dev -- --channel chrome --headed open https://example.com

# 或使用 Edge
bun dev -- --channel msedge --headed open https://example.com
```

### Snapshot 返回空

这是预期行为，因为 accessibility API 可能不可用。需要实现备选方案。

### 权限错误

确保 ~/.hba/sessions/ 目录有正确的权限：

```bash
chmod 700 ~/.hba/sessions/
```

## 安装 Skill 文件

将 Skill 文件复制到 Claude Code 技能目录：

```bash
mkdir -p ~/.claude/skills
cp skills/hyper-browser.md ~/.claude/skills/
```

## 项目结构说明

- `src/cli.ts` - CLI 入口，所有命令定义
- `src/browser/` - 浏览器管理和连接
- `src/session/` - Session 持久化和管理
- `src/commands/` - 所有命令的实现
- `src/snapshot/` - 快照系统（accessibility 树提取）
- `src/utils/` - 工具函数（选择器解析、配置、日志）

