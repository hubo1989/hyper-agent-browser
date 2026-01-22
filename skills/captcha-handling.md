---
alwaysApply: false
evolving: true

captcha:
  mode: manual
  maxWaitTime: 300000
---

# 验证码处理 Skill

当检测到验证码时暂停自动化任务，切换到 headed 模式让用户手动处理。

## 检测规则

以下任一条件满足即判定为验证码页面：

### 1. reCAPTCHA 检测

```typescript
const hasRecaptcha =
  snapshot.includes('recaptcha') ||
  snapshot.includes('g-recaptcha') ||
  await page.evaluate(() => !!document.querySelector('[data-sitekey]'));
```

### 2. hCaptcha 检测

```typescript
const hasHcaptcha =
  snapshot.includes('hcaptcha') ||
  snapshot.includes('h-captcha') ||
  await page.evaluate(() => !!document.querySelector('.h-captcha'));
```

### 3. 图形验证码检测

```typescript
// 检测常见验证码图片
const hasCaptchaImage =
  snapshot.includes('[img].*captcha') ||
  snapshot.includes('[img].*verify') ||
  snapshot.includes('验证码');
```

### 4. 滑块验证检测

```typescript
const hasSlider =
  snapshot.includes('滑动验证') ||
  snapshot.includes('slide to verify') ||
  snapshot.includes('drag the slider');
```

## 检测函数

```typescript
interface CaptchaDetectionResult {
  hasCaptcha: boolean;
  type: 'recaptcha' | 'hcaptcha' | 'image' | 'slider' | 'cloudflare' | 'unknown' | null;
  confidence: 'high' | 'medium' | 'low';
  element?: string;  // 验证码元素的 selector
}

function detectCaptcha(snapshot: string, html?: string): CaptchaDetectionResult {
  // reCAPTCHA
  if (snapshot.includes('recaptcha') || snapshot.includes('g-recaptcha')) {
    return { hasCaptcha: true, type: 'recaptcha', confidence: 'high' };
  }

  // hCaptcha
  if (snapshot.includes('hcaptcha') || snapshot.includes('h-captcha')) {
    return { hasCaptcha: true, type: 'hcaptcha', confidence: 'high' };
  }

  // Cloudflare Challenge
  if (snapshot.includes('Checking your browser') ||
      snapshot.includes('cf-challenge') ||
      snapshot.includes('Just a moment')) {
    return { hasCaptcha: true, type: 'cloudflare', confidence: 'high' };
  }

  // 滑块验证
  if (snapshot.includes('滑动') || snapshot.includes('slide') || snapshot.includes('drag')) {
    return { hasCaptcha: true, type: 'slider', confidence: 'medium' };
  }

  // 图形验证码
  if (snapshot.includes('captcha') || snapshot.includes('验证码')) {
    return { hasCaptcha: true, type: 'image', confidence: 'medium' };
  }

  return { hasCaptcha: false, type: null, confidence: 'low' };
}
```

## 处理流程

### 自动切换 headed 模式

```typescript
async function handleCaptcha(sessionName: string): Promise<boolean> {
  // 1. 保存当前 URL
  const currentUrl = await bash(`hab -s ${sessionName} url`);

  // 2. 关闭 headless 浏览器
  await bash(`hab -s ${sessionName} close`);

  // 3. 打开 headed 浏览器
  await bash(`hab -s ${sessionName} -H open "${currentUrl}"`);

  // 4. 通知用户
  console.log('检测到验证码，已打开浏览器窗口，请手动完成验证...');

  // 5. 轮询检测验证码是否完成
  const maxWait = 300000;  // 5 分钟
  const pollInterval = 5000;  // 5 秒
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await sleep(pollInterval);

    // 检测 URL 是否变化（可能跳转到目标页面）
    const newUrl = await bash(`hab -s ${sessionName} url`);
    if (newUrl !== currentUrl) {
      console.log('验证完成，页面已跳转');
      return true;
    }

    // 检测验证码元素是否消失
    const snapshot = await bash(`hab -s ${sessionName} snapshot -i`);
    const detection = detectCaptcha(snapshot);
    if (!detection.hasCaptcha) {
      console.log('验证码已完成');
      return true;
    }
  }

  console.log('验证码处理超时');
  return false;
}
```

### 完整工作流

```typescript
async function executeWithCaptchaHandling(
  sessionName: string,
  targetUrl: string,
  task: () => Promise<void>
): Promise<void> {
  // 1. 打开目标页面
  await bash(`hab -s ${sessionName} open "${targetUrl}"`);
  await bash(`hab -s ${sessionName} wait-idle`);

  // 2. 获取快照
  const snapshot = await bash(`hab -s ${sessionName} snapshot -i`);

  // 3. 检测验证码
  const captchaResult = detectCaptcha(snapshot);

  if (captchaResult.hasCaptcha) {
    console.log(`检测到 ${captchaResult.type} 验证码 (置信度: ${captchaResult.confidence})`);

    // 4. 处理验证码
    const success = await handleCaptcha(sessionName);

    if (!success) {
      throw new Error('验证码处理失败或超时');
    }

    // 5. 关闭 headed 浏览器，重新打开 headless
    await bash(`hab -s ${sessionName} close`);
    await bash(`hab -s ${sessionName} open "${targetUrl}"`);
    await bash(`hab -s ${sessionName} wait-idle`);
  }

  // 6. 执行原任务
  await task();
}
```

## 常见验证码类型

### 1. Google reCAPTCHA

```html
<!-- 特征 -->
<div class="g-recaptcha" data-sitekey="..."></div>
<iframe src="https://www.google.com/recaptcha/..."></iframe>
```

处理方式：headed 模式手动点击

### 2. hCaptcha

```html
<!-- 特征 -->
<div class="h-captcha" data-sitekey="..."></div>
```

处理方式：headed 模式手动完成

### 3. Cloudflare Challenge

```html
<!-- 特征 -->
<title>Just a moment...</title>
<div id="cf-challenge-running">Checking your browser...</div>
```

处理方式：等待自动通过或 headed 模式手动处理

### 4. 滑块验证

常见于国内网站（阿里、腾讯等）

```html
<!-- 特征 -->
<div class="nc_wrapper">滑动验证</div>
```

处理方式：headed 模式手动滑动

### 5. 图形验证码

```html
<!-- 特征 -->
<img src="/captcha/generate" id="captcha-img">
<input type="text" name="captcha">
```

处理方式：headed 模式手动输入

## 用户交互

使用 AskUserQuestion 通知用户：

```typescript
await askUser({
  question: '检测到验证码，已打开浏览器窗口。请完成验证后点击确认。',
  header: 'CAPTCHA',
  options: [
    { label: '已完成验证', description: '我已手动完成验证码' },
    { label: '需要更多时间', description: '请再等待一会儿' },
    { label: '跳过此任务', description: '无法完成验证，跳过当前任务' },
  ],
  multiSelect: false,
});
```

## 配置覆盖

```yaml
---
captcha:
  mode: manual           # 始终手动处理
  maxWaitTime: 600000    # 10 分钟超时
  notifyUser: true       # 通知用户
---
```

## 注意事项

1. **Session 复用**：验证码通过后，登录态保存在 session 中，后续请求不再需要验证
2. **避免频繁触发**：降低请求频率，使用合理的 wait 间隔
3. **使用真实浏览器**：Patchright 的反检测能力可以减少验证码出现
4. **IP 质量**：使用住宅 IP 可以减少验证码触发
