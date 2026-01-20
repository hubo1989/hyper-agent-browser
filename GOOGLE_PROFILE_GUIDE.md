# 使用 Google 登录 Profile 的完整指南

## 🎯 三种方案

### 方案 1: 导入现有 Chrome Profile（推荐）

**优点**: 立即可用，保留所有登录状态
**适用**: 已经在系统 Chrome 中登录了 Google

```bash
# 一键导入（自动检测 Chrome Profile）
./scripts/import-chrome-profile.sh -s gmail

# 或指定特定 Profile
./scripts/import-chrome-profile.sh -s gmail \
  --profile ~/Library/Application\ Support/Google/Chrome/Profile\ 1
```

### 方案 2: 手动登录一次，后续复用

**优点**: 不依赖系统 Chrome，独立管理
**适用**: 想要专门的测试账号或隔离环境

```bash
# 1. 创建新 session 并打开 Google 登录页
bun dev -- -s my-gmail --headed open https://accounts.google.com

# 2. 在打开的浏览器窗口中手动登录
# （输入邮箱、密码、完成二次验证等）

# 3. 登录完成后，关闭浏览器
bun dev -- -s my-gmail close

# 4. 下次使用时，登录状态已保存
bun dev -- -s my-gmail --headed open https://mail.google.com
```

### 方案 3: 使用环境变量指定 Profile

在 CLI 中添加 `--user-data-dir` 选项直接指定路径。

## 📝 实际使用示例

### 示例 1: Gmail 自动化

```bash
# 导入 Profile
./scripts/import-chrome-profile.sh -s gmail

# 打开 Gmail
bun dev -- -s gmail --headed open https://mail.google.com

# 等待加载
bun dev -- -s gmail wait 3000

# 获取页面快照
bun dev -- -s gmail snapshot -i

# 查找"撰写"按钮并点击（使用 CSS 选择器）
bun dev -- -s gmail click 'css=div[role="button"][gh="cm"]'

# 或使用文本选择器
bun dev -- -s gmail click 'text=写邮件'

# 关闭
bun dev -- -s gmail close
```

### 示例 2: Google Drive 文件操作

```bash
# 使用已登录的 session
bun dev -- -s gmail --headed open https://drive.google.com

# 等待加载
bun dev -- -s gmail wait 5000

# 获取快照查看可用元素
bun dev -- -s gmail snapshot -i

# 点击"新建"按钮
bun dev -- -s gmail click 'text=新建'

# 截图保存当前状态
bun dev -- -s gmail screenshot -o drive.png

# 关闭
bun dev -- -s gmail close
```

### 示例 3: Google Calendar 查看日程

```bash
# 打开日历
bun dev -- -s gmail --headed open https://calendar.google.com

# 获取页面内容
bun dev -- -s gmail content --max-length 5000

# 获取当前 URL
bun dev -- -s gmail url

# 关闭
bun dev -- -s gmail close
```

## 🔍 验证登录状态

### 方法 1: 检查 URL

```bash
# 打开需要登录的页面
bun dev -- -s gmail --headed open https://mail.google.com

# 获取当前 URL
bun dev -- -s gmail url

# 如果返回 https://mail.google.com/... 说明已登录
# 如果重定向到 https://accounts.google.com/... 说明未登录
```

### 方法 2: 执行 JavaScript 检查

```bash
# 检查是否有用户信息
bun dev -- -s gmail open https://mail.google.com
bun dev -- -s gmail wait 3000
bun dev -- -s gmail evaluate "document.querySelector('[data-email]')?.getAttribute('data-email')"
```

### 方法 3: 截图检查

```bash
bun dev -- -s gmail --headed open https://mail.google.com
bun dev -- -s gmail wait 3000
bun dev -- -s gmail screenshot -o gmail-check.png
open gmail-check.png  # 查看是否显示登录后的界面
```

## ⚙️ 高级配置

### 使用多个 Google 账号

```bash
# 账号 1: 个人邮箱
./scripts/import-chrome-profile.sh -s personal-gmail \
  --profile ~/Library/Application\ Support/Google/Chrome/Default

# 账号 2: 工作邮箱
./scripts/import-chrome-profile.sh -s work-gmail \
  --profile ~/Library/Application\ Support/Google/Chrome/Profile\ 1

# 使用不同账号
bun dev -- -s personal-gmail open https://mail.google.com
bun dev -- -s work-gmail open https://mail.google.com
```

### 定期更新 Cookies

Chrome 的 Cookies 会过期，需要定期更新：

```bash
# 方法 1: 重新导入 Profile
./scripts/import-chrome-profile.sh -s gmail

# 方法 2: 手动重新登录
bun dev -- -s gmail --headed open https://accounts.google.com
# 重新登录后关闭
bun dev -- -s gmail close
```

### 备份 Session

```bash
# 备份包含登录状态的 Session
tar -czf gmail-session-backup.tar.gz ~/.hab/sessions/gmail/

# 恢复
tar -xzf gmail-session-backup.tar.gz -C ~/
```

## 🛡️ 安全注意事项

1. **Session 目录权限**
   ```bash
   # 确保只有当前用户可以访问
   chmod 700 ~/.hab/sessions/
   chmod 700 ~/.hab/sessions/*/
   ```

2. **不要在公共仓库提交 Session**
   - `.gitignore` 已包含 `~/.hab/` 排除规则
   - 不要将 `userdata` 目录提交到版本控制

3. **定期检查登录会话**
   ```bash
   # 列出所有 session
   bun dev -- sessions

   # 清理不用的 session
   rm -rf ~/.hab/sessions/old-session-name/
   ```

## 🐛 故障排除

### 问题 1: 导入后仍需要登录

**原因**: Cookies 可能已过期或 Profile 路径不正确

**解决**:
```bash
# 检查 Chrome Profile 路径
ls ~/Library/Application\ Support/Google/Chrome/

# 手动登录一次
bun dev -- -s gmail --headed open https://accounts.google.com
```

### 问题 2: 权限错误

**解决**:
```bash
chmod -R 700 ~/.hab/sessions/
```

### 问题 3: Session 冲突

**原因**: 同时在系统 Chrome 和 hab 中使用同一个 Profile

**解决**: 使用复制的 Profile，而不是直接指向系统 Chrome 的 Profile

## 📚 相关文档

- [GETTING_STARTED.md](./GETTING_STARTED.md) - 基础使用指南
- [README.md](./README.md) - 项目说明
- [skills/hyper-browser.md](./skills/hyper-browser.md) - AI Agent 集成
