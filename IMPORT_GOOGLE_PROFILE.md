# 使用已登录的 Google Profile

## 方案 1: 使用系统 Chrome Profile（推荐）

### 步骤 1: 找到 Chrome Profile 路径

```bash
# macOS
~/Library/Application Support/Google/Chrome/

# Linux
~/.config/google-chrome/

# Windows
%LOCALAPPDATA%\Google\Chrome\User Data\
```

### 步骤 2: 查看可用的 Profile

```bash
# macOS 示例
ls ~/Library/Application\ Support/Google/Chrome/
# 输出: Default, Profile 1, Profile 2, ...
```

### 步骤 3: 复制 Profile 到 hba Session

```bash
# 创建一个使用 Google 账号的 session
SESSION_NAME="gmail-logged-in"

# 方法 A: 复制整个 Default profile
cp -r ~/Library/Application\ Support/Google/Chrome/Default \
      ~/.hba/sessions/$SESSION_NAME/userdata/Default

# 方法 B: 只复制必要的文件（推荐，更轻量）
mkdir -p ~/.hba/sessions/$SESSION_NAME/userdata/Default
cp -r ~/Library/Application\ Support/Google/Chrome/Default/Cookies \
      ~/.hba/sessions/$SESSION_NAME/userdata/Default/
cp -r ~/Library/Application\ Support/Google/Chrome/Default/Local\ Storage \
      ~/.hba/sessions/$SESSION_NAME/userdata/Default/
cp -r ~/Library/Application\ Support/Google/Chrome/Default/Session\ Storage \
      ~/.hba/sessions/$SESSION_NAME/userdata/Default/
```

### 步骤 4: 使用该 Session

```bash
# 现在使用这个 session，会保留 Google 登录状态
bun dev -- -s gmail-logged-in --headed open https://mail.google.com

# 检查是否已登录
bun dev -- -s gmail-logged-in snapshot -i
```

## 方案 2: 手动登录一次，后续复用

### 步骤 1: 创建新 Session 并手动登录

```bash
# 启动浏览器（显示窗口）
bun dev -- -s my-google --headed open https://accounts.google.com

# 在浏览器中手动登录 Google 账号
# 登录完成后关闭
bun dev -- -s my-google close
```

### 步骤 2: 后续使用

```bash
# 再次使用该 session，登录状态已保存
bun dev -- -s my-google --headed open https://mail.google.com
bun dev -- -s my-google snapshot -i
```

## 方案 3: 脚本自动化（添加专用命令）

我们可以添加一个 `import-profile` 命令来简化这个过程。
