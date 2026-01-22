---
alwaysApply: false
evolving: true

loginDetection:
  mode: auto
  pollInterval: 60000
  maxWaitTime: 600000
---

# 智能登录检测 Skill

当 AI Agent 使用 hab 访问需要登录的页面时，自动检测登录状态并处理。

## 检测规则

以下任一条件满足即判定为"需要登录"：

1. **URL 检测**：路径包含 `/login`, `/signin`, `/auth`, `/sso`, `/oauth`
2. **重定向检测**：URL 包含 `redirect`, `return_to`, `next=`, `continue=` 参数
3. **页面元素检测**：snapshot 显示登录表单（用户名/邮箱输入框 + 密码输入框 + 登录按钮）
4. **标题检测**：页面标题包含"登录"、"Login"、"Sign in"、"Log in"

## 行为模式

| 模式 | 配置值 | 行为 |
|------|--------|------|
| **自动模式** | `auto`（默认） | 检测到登录页 → 自动切换 headed → 轮询等待登录完成 → 自动切回 headless |
| **确认模式** | `confirm` | 检测到登录页 → 询问用户确认 → 用户同意后切换 → 登录后再次确认 |

## 执行流程

### 自动模式 (auto)

```bash
# 1. 打开目标页面
hab open <url>
hab wait 3000

# 2. 获取快照分析
hab snapshot -i

# 3. 检测是否为登录页（使用下方检测函数）
# 如果检测到登录页：

# 4a. 关闭当前 headless 浏览器
hab close

# 4b. 启动 headed 浏览器打开登录页
hab -H open <login_url>

# 4c. 轮询检测登录完成（每 60 秒检查一次）
# 检测条件：URL 不再包含 login/signin/auth 路径
while true; do
  sleep 60
  current_url=$(hab url)
  if [[ ! "$current_url" =~ (login|signin|auth|sso) ]]; then
    break
  fi
done

# 4d. 关闭 headed 浏览器
hab close

# 4e. 重新打开原目标 URL（headless 模式，复用登录态）
hab open <original_target_url>

# 5. 继续执行原任务
```

### 确认模式 (confirm)

在自动模式的步骤 4 之前，使用 AskUserQuestion 询问：

```markdown
检测到需要登录 [site_name]，是否打开浏览器窗口进行手动登录？

选项：
- 是，打开浏览器登录
- 否，跳过此任务
- 使用其他账号/Session
```

登录完成后，再次确认：

```markdown
请确认是否已完成登录？

选项：
- 已完成登录
- 需要更多时间
- 取消任务
```

## 登录检测函数

在 Agent 端实现以下检测逻辑：

```typescript
interface LoginDetectionResult {
  isLoginPage: boolean;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
}

function detectLoginPage(url: string, title: string, snapshot: string): LoginDetectionResult {
  const indicators: string[] = [];
  let score = 0;

  // URL 检测
  const loginPaths = ['/login', '/signin', '/auth', '/sso', '/oauth', '/account/login'];
  if (loginPaths.some(path => url.toLowerCase().includes(path))) {
    indicators.push('URL contains login path');
    score += 3;
  }

  // 重定向参数检测
  const redirectParams = ['redirect', 'return_to', 'next=', 'continue=', 'callback'];
  if (redirectParams.some(param => url.toLowerCase().includes(param))) {
    indicators.push('URL contains redirect parameter');
    score += 1;
  }

  // 标题检测
  const loginTitles = ['登录', 'login', 'sign in', 'log in', '로그인', 'ログイン'];
  if (loginTitles.some(t => title.toLowerCase().includes(t))) {
    indicators.push('Title contains login keyword');
    score += 2;
  }

  // Snapshot 元素检测
  const hasPasswordField = /\[textbox\].*password|密码|\[password\]/i.test(snapshot);
  const hasUsernameField = /\[textbox\].*(user|email|账号|用户|邮箱)/i.test(snapshot);
  const hasLoginButton = /\[button\].*(login|sign in|登录|submit)/i.test(snapshot);

  if (hasPasswordField) {
    indicators.push('Password field detected');
    score += 3;
  }
  if (hasUsernameField) {
    indicators.push('Username/email field detected');
    score += 2;
  }
  if (hasLoginButton) {
    indicators.push('Login button detected');
    score += 2;
  }

  // 判定置信度
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 6) confidence = 'high';
  else if (score >= 3) confidence = 'medium';
  else confidence = 'low';

  return {
    isLoginPage: score >= 3,
    confidence,
    indicators,
  };
}
```

## 完整工作流示例

```typescript
async function executeWithLoginDetection(targetUrl: string, task: () => Promise<void>) {
  // 1. 打开目标页面
  await bash(`hab open "${targetUrl}"`);
  await bash(`hab wait 3000`);

  // 2. 获取页面信息
  const url = await bash(`hab url`);
  const title = await bash(`hab title`);
  const snapshot = await bash(`hab snapshot -i`);

  // 3. 检测登录页
  const detection = detectLoginPage(url, title, snapshot);

  if (detection.isLoginPage && detection.confidence !== 'low') {
    console.log(`检测到登录页 (${detection.confidence}): ${detection.indicators.join(', ')}`);

    // 4. 处理登录
    await bash(`hab close`);
    await bash(`hab -H open "${url}"`);

    // 5. 等待用户完成登录（轮询检测）
    let loggedIn = false;
    const maxWait = 600000; // 10 分钟
    const pollInterval = 60000; // 1 分钟
    const startTime = Date.now();

    while (!loggedIn && Date.now() - startTime < maxWait) {
      await sleep(pollInterval);
      const currentUrl = await bash(`hab url`);
      const newDetection = detectLoginPage(currentUrl, '', '');
      if (!newDetection.isLoginPage) {
        loggedIn = true;
      }
    }

    if (!loggedIn) {
      throw new Error('登录超时');
    }

    // 6. 关闭 headed 浏览器，重新打开 headless
    await bash(`hab close`);
    await bash(`hab open "${targetUrl}"`);
    await bash(`hab wait 3000`);
  }

  // 7. 执行原任务
  await task();
}
```

## 用户覆盖配置

在用户自定义 Skill 中覆盖默认行为：

```yaml
---
loginDetection:
  mode: confirm  # 银行等敏感操作需要用户确认
  pollInterval: 30000  # 更频繁的轮询
  maxWaitTime: 300000  # 5 分钟超时
---

# my-bank-workflow

处理银行网站的自动化操作...
```

## 常见登录页 URL 模式

```
# Google
accounts.google.com/signin
accounts.google.com/ServiceLogin

# GitHub
github.com/login
github.com/session

# Twitter/X
twitter.com/login
x.com/login

# Facebook
facebook.com/login
facebook.com/login.php

# LinkedIn
linkedin.com/login
linkedin.com/uas/login

# Microsoft
login.microsoftonline.com
login.live.com

# Amazon
amazon.com/ap/signin
amazon.com/gp/sign-in

# Generic patterns
*/login
*/signin
*/auth/*
*/oauth/*
*/sso/*
*/account/login
*/user/login
```

## 注意事项

1. **Session 隔离**：不同网站使用不同的 session（`hab -s gmail`, `hab -s github`）
2. **Cookie 持久化**：登录状态保存在 session 的 userdata 目录中
3. **多因素认证**：检测到 MFA 页面时，延长等待时间
4. **验证码**：如果检测到验证码，参考 `captcha-handling.md`
