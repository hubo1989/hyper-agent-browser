---
alwaysApply: false
evolving: true
---

# 文件下载指南 Skill

使用 hab 的下载功能从网页下载文件，自动携带登录态和 Cookies。

## 命令概览

```bash
# 点击元素触发下载
hab download <selector>              # 点击下载链接/按钮
hab download <selector> -o <path>    # 指定保存路径

# 直接下载 URL
hab download-url <url>               # 下载指定 URL
hab download-url <url> -o <path>     # 指定保存路径
```

## 使用场景

### 1. 点击下载按钮

```bash
# 获取页面快照
hab snapshot -i

# 输出示例:
# @e5  [link]    "下载报告"
# @e6  [button]  "Export PDF"

# 点击下载
hab download @e5
# 输出: Downloaded: report-2024.pdf (2.5 MB)
#       Saved to: /current/dir/report-2024.pdf

# 指定保存位置
hab download @e6 -o ~/Downloads/
hab download @e6 -o ~/Documents/my-report.pdf
```

### 2. 直接下载 URL

```bash
# 下载公开文件
hab download-url "https://example.com/file.zip"

# 下载需要登录的文件（自动携带 session cookies）
hab -s myaccount download-url "https://app.example.com/api/export/data.csv"

# 指定保存路径
hab download-url "https://example.com/file.pdf" -o ~/Documents/
```

### 3. 需要登录才能下载的文件

```bash
# 1. 先登录（或确保已有登录态）
hab -s github open "https://github.com/login"
# ... 手动登录或自动登录 ...

# 2. 导航到下载页面
hab -s github open "https://github.com/user/repo/releases"
hab -s github wait-idle
hab -s github snapshot -i

# 3. 下载文件
hab -s github download @e10 -o ~/Downloads/
```

## 与其他工具对比

| 方法 | 优势 | 劣势 |
|------|------|------|
| `hab download` | 自动携带登录态、处理 JS 触发的下载 | 需要浏览器运行 |
| `curl`/`wget` | 轻量、快速 | 不携带浏览器登录态 |
| 浏览器手动下载 | 直观 | 无法自动化 |

## 完整工作流示例

### 下载需要登录的报告

```typescript
async function downloadAuthenticatedReport(reportUrl: string, outputPath: string) {
  const sessionName = 'report-session';

  // 1. 打开报告页面
  await bash(`hab -s ${sessionName} open "${reportUrl}"`);
  await bash(`hab -s ${sessionName} wait-idle`);

  // 2. 检测是否需要登录
  const url = await bash(`hab -s ${sessionName} url`);
  if (url.includes('login')) {
    // 切换 headed 模式让用户登录
    await bash(`hab -s ${sessionName} close`);
    await bash(`hab -s ${sessionName} -H open "${url}"`);

    // 等待用户登录完成
    await waitForLogin(sessionName);

    // 关闭 headed，重新打开 headless
    await bash(`hab -s ${sessionName} close`);
    await bash(`hab -s ${sessionName} open "${reportUrl}"`);
    await bash(`hab -s ${sessionName} wait-idle`);
  }

  // 3. 获取下载按钮
  const snapshot = await bash(`hab -s ${sessionName} snapshot -i`);

  // 4. 找到下载按钮并点击下载
  // 假设 AI 分析 snapshot 后确定 @e8 是下载按钮
  const result = await bash(`hab -s ${sessionName} download @e8 -o "${outputPath}"`);

  console.log(result);
  // Downloaded: monthly-report.pdf (1.2 MB)
  // Saved to: /Users/user/Documents/monthly-report.pdf
}
```

### 批量下载

```typescript
async function batchDownload(urls: string[], outputDir: string) {
  for (const url of urls) {
    await bash(`hab download-url "${url}" -o "${outputDir}"`);
    await bash(`hab wait 1000`);  // 避免请求过快
  }
}
```

### 下载动态生成的文件

某些网站的下载链接是动态生成的（如导出功能）：

```typescript
async function downloadDynamicExport() {
  // 1. 点击导出按钮
  await bash(`hab click @e5`);

  // 2. 等待导出准备完成（可能出现进度条或确认对话框）
  await bash(`hab wait-element "text=下载" --timeout 30000`);

  // 3. 获取更新后的快照
  await bash(`hab snapshot -i`);

  // 4. 点击下载链接
  await bash(`hab download @e12 -o ~/Downloads/`);
}
```

## 超时配置

```bash
# 默认超时 60 秒
hab download @e5

# 大文件设置更长超时（5 分钟）
hab download @e5 --timeout 300000

# 下载 URL 同样支持
hab download-url "https://example.com/large-file.zip" --timeout 600000
```

## 错误处理

### 下载超时

```typescript
try {
  await bash(`hab download @e5 --timeout 120000`);
} catch (error) {
  if (error.message.includes('timeout')) {
    console.log('下载超时，文件可能过大或网络较慢');
    // 可以尝试增加超时时间重试
  }
}
```

### 元素不触发下载

```typescript
// 有些按钮需要先滚动到视图
await bash(`hab scrollintoview @e5`);
await bash(`hab wait 500`);
await bash(`hab download @e5`);
```

### 下载被阻止

某些网站可能阻止自动下载，需要先进行交互：

```typescript
// 先点击一次确认按钮
await bash(`hab click @e3`);  // "我同意条款"
await bash(`hab wait 1000`);

// 然后下载
await bash(`hab download @e5`);
```

## 最佳实践

1. **使用独立 Session**：为不同网站使用不同的 session 管理登录态
2. **先验证登录**：下载前确保已登录或处理登录检测
3. **设置合理超时**：根据预期文件大小设置超时时间
4. **指定输出目录**：避免文件下载到意外位置
5. **处理动态下载**：某些网站需要先触发导出，再下载
