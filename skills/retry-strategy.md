---
alwaysApply: false
evolving: true

retry:
  maxAttempts: 3
  backoff: exponential
  baseDelay: 2000
---

# 操作重试策略 Skill

当 hab 操作失败时，按照智能策略进行重试和降级处理。

## 重试规则

| 错误类型 | 错误特征 | 重试策略 |
|----------|----------|----------|
| 元素未找到 | `Element not found`, `@eN not found` | 等待 2s → 刷新 snapshot → 重试 |
| 点击被拦截 | `intercepts pointer events` | hab 自动降级（force click → dispatchEvent） |
| 元素不可见 | `not visible`, `hidden` | 滚动到视图 → 等待可见 → 重试 |
| 超时 | `timeout`, `Timeout` | 增加超时时间（×2）→ 重试 |
| 网络错误 | `net::`, `Network`, `Failed to load` | 等待 5s → 重试 |
| 页面导航中 | `navigating`, `detached` | 等待 navigation → 重试 |

## 执行流程

```typescript
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  backoff: 'linear' | 'exponential';
}

const defaultConfig: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 2000,
  backoff: 'exponential',
};

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = defaultConfig,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = lastError.message.toLowerCase();

      // 判断是否可重试
      if (!isRetryable(errorMessage)) {
        throw lastError;
      }

      // 计算延迟时间
      const delay = calculateDelay(attempt, config);

      console.log(`尝试 ${attempt}/${config.maxAttempts} 失败: ${lastError.message}`);
      console.log(`等待 ${delay}ms 后重试...`);

      // 执行恢复策略
      await executeRecovery(errorMessage);

      // 等待
      await sleep(delay);
    }
  }

  throw new Error(`操作失败，已重试 ${config.maxAttempts} 次: ${lastError?.message}`);
}

function isRetryable(errorMessage: string): boolean {
  const retryablePatterns = [
    'element not found',
    'not found',
    'timeout',
    'net::',
    'network',
    'failed to load',
    'navigating',
    'detached',
    'not visible',
    'hidden',
  ];

  return retryablePatterns.some(pattern => errorMessage.includes(pattern));
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  if (config.backoff === 'exponential') {
    return config.baseDelay * Math.pow(2, attempt - 1);
  }
  return config.baseDelay * attempt;
}

async function executeRecovery(errorMessage: string): Promise<void> {
  if (errorMessage.includes('not found')) {
    // 刷新 snapshot
    await bash(`hab snapshot -i`);
  } else if (errorMessage.includes('not visible') || errorMessage.includes('hidden')) {
    // 尝试滚动到视图
    // 注意：需要知道 selector，这里仅作示意
    await bash(`hab wait 1000`);
  } else if (errorMessage.includes('net::') || errorMessage.includes('network')) {
    // 网络错误，等待更长时间
    await bash(`hab wait 5000`);
  } else if (errorMessage.includes('navigating') || errorMessage.includes('detached')) {
    // 等待导航完成
    await bash(`hab wait --load networkidle`);
  }
}
```

## 使用示例

### 基础重试

```typescript
// 点击操作带重试
await executeWithRetry(async () => {
  await bash(`hab click @e5`);
});

// 填充表单带重试
await executeWithRetry(async () => {
  await bash(`hab fill @e3 "test@example.com"`);
});
```

### 自定义重试配置

```typescript
// 更多重试次数，更长等待
await executeWithRetry(
  async () => {
    await bash(`hab click @e5`);
  },
  {
    maxAttempts: 5,
    baseDelay: 3000,
    backoff: 'exponential',
  }
);
```

### 元素未找到的完整处理流程

```typescript
async function clickElementWithRecovery(selector: string): Promise<void> {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      await bash(`hab click ${selector}`);
      return;
    } catch (error) {
      attempts++;
      const msg = (error as Error).message;

      if (msg.includes('not found')) {
        console.log(`元素 ${selector} 未找到，刷新快照重试...`);

        // 等待页面稳定
        await bash(`hab wait-idle`);

        // 刷新快照
        const snapshot = await bash(`hab snapshot -i`);

        // 分析快照，尝试找到相似元素
        // 这里可以用 AI 分析快照内容

        if (attempts < maxAttempts) {
          continue;
        }
      }

      throw error;
    }
  }
}
```

## 错误分类与处理

### 1. 元素定位错误

```typescript
// 错误: Element reference @e5 not found
// 处理: 刷新 snapshot，重新定位

await bash(`hab snapshot -i`);  // 刷新获取新的元素引用
// 然后让 AI 重新分析 snapshot 找到目标元素
```

### 2. 元素交互错误

```typescript
// 错误: Element intercepts pointer events
// 处理: hab 已内置降级，通常自动处理

// 如果仍失败，可尝试:
await bash(`hab scrollintoview ${selector}`);  // 滚动到视图
await bash(`hab wait 1000`);                    // 等待动画
await bash(`hab click ${selector}`);            // 重试点击
```

### 3. 超时错误

```typescript
// 错误: Timeout 30000ms exceeded
// 处理: 增加超时时间

await bash(`hab -t 60000 open "https://slow-site.com"`);  // 60秒超时
```

### 4. 网络错误

```typescript
// 错误: net::ERR_CONNECTION_REFUSED
// 处理: 等待后重试

await bash(`hab wait 5000`);
await bash(`hab reload`);
```

## 最佳实践

### 1. 操作前确保页面稳定

```bash
# 推荐流程
hab open <url>
hab wait-idle              # 等待页面稳定
hab snapshot -i            # 获取元素快照
hab click @e5              # 执行操作
```

### 2. 使用智能等待而非固定等待

```bash
# ❌ 不推荐
hab wait 5000

# ✅ 推荐
hab wait-idle
hab wait-element @e5 --state visible
```

### 3. 连续失败后报告

```typescript
if (attempts >= maxAttempts) {
  // 收集诊断信息
  const screenshot = await bash(`hab screenshot -o error-screenshot.png`);
  const snapshot = await bash(`hab snapshot -i`);
  const url = await bash(`hab url`);

  // 报告错误，询问用户
  await askUser({
    message: `操作失败 ${maxAttempts} 次，需要帮助吗？`,
    context: { url, snapshot, screenshot },
  });
}
```

## 配置覆盖

```yaml
---
retry:
  maxAttempts: 5        # 更多重试次数
  baseDelay: 1000       # 更短的基础延迟
  backoff: linear       # 线性增长
---
```
