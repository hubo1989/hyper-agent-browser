---
alwaysApply: false
evolving: true

monitoring:
  defaultInterval: 3600000
  compareMode: text
---

# 网页监控 Skill

定期检查网页变化，触发通知。适用于价格监控、库存监控、内容更新检测等场景。

## 使用场景

| 场景 | 监控目标 | 通知触发条件 |
|------|----------|--------------|
| 价格监控 | 商品价格元素 | 价格变化 |
| 库存监控 | 库存状态/购买按钮 | 从"缺货"变为"有货" |
| 内容更新 | 文章列表/更新时间 | 新内容出现 |
| 状态监控 | 服务状态页面 | 状态变化 |

## 基础命令

```bash
# 获取页面快照用于监控
hab open <url>
hab wait-idle
hab snapshot -i

# 提取特定数据
hab evaluate "document.querySelector('.price').textContent"
hab get text ".price"

# 截图对比
hab screenshot -o snapshot-$(date +%Y%m%d).png
```

## 监控流程

```typescript
interface MonitorConfig {
  url: string;
  selector: string;
  interval: number;      // 检查间隔（毫秒）
  compareMode: 'text' | 'html' | 'screenshot';
  notifyOnChange: boolean;
}

interface MonitorResult {
  timestamp: Date;
  value: string;
  changed: boolean;
  previousValue?: string;
}

async function monitorPage(config: MonitorConfig): Promise<MonitorResult> {
  const sessionName = `monitor-${Date.now()}`;

  // 1. 打开页面
  await bash(`hab -s ${sessionName} open "${config.url}"`);
  await bash(`hab -s ${sessionName} wait-idle`);

  // 2. 提取目标数据
  let currentValue: string;

  switch (config.compareMode) {
    case 'text':
      currentValue = await bash(`hab -s ${sessionName} get text "${config.selector}"`);
      break;
    case 'html':
      currentValue = await bash(`hab -s ${sessionName} get html "${config.selector}"`);
      break;
    case 'screenshot':
      const screenshotPath = `/tmp/monitor-${Date.now()}.png`;
      await bash(`hab -s ${sessionName} screenshot --selector "${config.selector}" -o ${screenshotPath}`);
      currentValue = screenshotPath;
      break;
  }

  // 3. 关闭浏览器（释放资源）
  await bash(`hab -s ${sessionName} close`);

  // 4. 与历史数据对比
  const previousValue = await loadPreviousValue(config.url, config.selector);
  const changed = previousValue !== undefined && previousValue !== currentValue;

  // 5. 保存当前值
  await saveCurrentValue(config.url, config.selector, currentValue);

  return {
    timestamp: new Date(),
    value: currentValue,
    changed,
    previousValue,
  };
}
```

## 价格监控示例

```typescript
async function monitorPrice(productUrl: string, targetPrice: number): Promise<void> {
  const result = await monitorPage({
    url: productUrl,
    selector: '.price, [data-price], .product-price',
    interval: 3600000,  // 每小时检查
    compareMode: 'text',
    notifyOnChange: true,
  });

  // 解析价格
  const priceText = result.value.replace(/[^0-9.]/g, '');
  const currentPrice = parseFloat(priceText);

  if (currentPrice <= targetPrice) {
    await notify({
      title: '价格降至目标价格！',
      body: `当前价格: ¥${currentPrice}，目标价格: ¥${targetPrice}`,
      url: productUrl,
    });
  }

  if (result.changed) {
    await notify({
      title: '价格变动',
      body: `${result.previousValue} → ${result.value}`,
      url: productUrl,
    });
  }
}
```

## 库存监控示例

```typescript
async function monitorStock(productUrl: string): Promise<void> {
  const sessionName = 'stock-monitor';

  await bash(`hab -s ${sessionName} open "${productUrl}"`);
  await bash(`hab -s ${sessionName} wait-idle`);

  // 获取页面快照
  const snapshot = await bash(`hab -s ${sessionName} snapshot -i`);

  // 检测库存状态
  const inStock =
    !snapshot.includes('缺货') &&
    !snapshot.includes('out of stock') &&
    !snapshot.includes('sold out') &&
    (snapshot.includes('加入购物车') ||
     snapshot.includes('add to cart') ||
     snapshot.includes('立即购买'));

  if (inStock) {
    await notify({
      title: '商品有货了！',
      body: '检测到库存可用',
      url: productUrl,
      priority: 'high',
    });
  }

  await bash(`hab -s ${sessionName} close`);
}
```

## 内容更新监控示例

```typescript
async function monitorContentUpdates(feedUrl: string): Promise<void> {
  const sessionName = 'content-monitor';

  await bash(`hab -s ${sessionName} open "${feedUrl}"`);
  await bash(`hab -s ${sessionName} wait-idle`);

  // 提取最新文章标题
  const latestTitles = await bash(`hab -s ${sessionName} evaluate "
    Array.from(document.querySelectorAll('article h2, .post-title'))
      .slice(0, 5)
      .map(el => el.textContent.trim())
      .join('\\n')
  "`);

  // 与上次对比
  const previousTitles = await loadPreviousValue(feedUrl, 'titles');

  if (previousTitles && latestTitles !== previousTitles) {
    // 找出新增的标题
    const prevSet = new Set(previousTitles.split('\n'));
    const newTitles = latestTitles
      .split('\n')
      .filter(title => !prevSet.has(title));

    if (newTitles.length > 0) {
      await notify({
        title: '新内容发布',
        body: newTitles.join('\n'),
        url: feedUrl,
      });
    }
  }

  await saveCurrentValue(feedUrl, 'titles', latestTitles);
  await bash(`hab -s ${sessionName} close`);
}
```

## 定时执行

### 使用 cron

```bash
# 每小时检查价格
0 * * * * /path/to/monitor-script.sh

# 每 15 分钟检查库存
*/15 * * * * /path/to/stock-monitor.sh
```

### 使用循环

```typescript
async function startMonitoring(
  checkFunction: () => Promise<void>,
  intervalMs: number
): Promise<void> {
  while (true) {
    try {
      await checkFunction();
    } catch (error) {
      console.error('监控检查失败:', error);
    }

    await sleep(intervalMs);
  }
}

// 每小时检查
startMonitoring(() => monitorPrice('https://example.com/product', 99), 3600000);
```

## 通知方式

### 1. 控制台输出

```typescript
console.log(`[${new Date().toISOString()}] 检测到变化: ${result.value}`);
```

### 2. 系统通知（macOS）

```bash
osascript -e 'display notification "价格降了！" with title "监控提醒"'
```

### 3. Webhook

```typescript
await fetch('https://hooks.slack.com/services/...', {
  method: 'POST',
  body: JSON.stringify({
    text: `价格变动: ${previousPrice} → ${currentPrice}`,
  }),
});
```

### 4. 邮件

```bash
echo "价格降至 $99" | mail -s "价格提醒" user@example.com
```

## 数据存储

### 简单文件存储

```typescript
const DATA_DIR = '~/.hab/monitor-data';

async function saveCurrentValue(url: string, selector: string, value: string): Promise<void> {
  const key = hashKey(url, selector);
  const filePath = `${DATA_DIR}/${key}.json`;

  await Bun.write(filePath, JSON.stringify({
    url,
    selector,
    value,
    timestamp: new Date().toISOString(),
  }));
}

async function loadPreviousValue(url: string, selector: string): Promise<string | undefined> {
  const key = hashKey(url, selector);
  const filePath = `${DATA_DIR}/${key}.json`;

  try {
    const data = await Bun.file(filePath).json();
    return data.value;
  } catch {
    return undefined;
  }
}
```

## 配置覆盖

```yaml
---
monitoring:
  defaultInterval: 1800000    # 30 分钟
  compareMode: text
  retryOnError: true
  maxRetries: 3
---
```

## 注意事项

1. **请求频率**：避免过于频繁的请求，可能被网站封禁
2. **Session 管理**：每次监控使用独立 session 或复用同一 session
3. **资源释放**：监控完成后关闭浏览器释放资源
4. **错误处理**：网络错误时重试，连续失败时报警
5. **反爬虫**：使用随机间隔，模拟真实用户行为
