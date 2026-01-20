# 数据提取能力使用指南

本指南介绍 hyper-agent-browser 的数据提取和网络监听能力，帮助 AI Agent 高效抓取和分析网页数据。

## 目录

- [等待命令](#等待命令)
- [数据提取命令](#数据提取命令)
- [网络监听命令](#网络监听命令)
- [使用场景示例](#使用场景示例)

---

## 等待命令

### `wait-idle` - 等待页面空闲

等待页面加载完成，包括网络请求和 DOM 变化都稳定。

**语法：**
```bash
hab wait-idle [options]
```

**选项：**
- `--timeout <ms>` - 超时时间（默认 30000ms）
- `--strategy <strategy>` - 策略：network, dom, both（默认 both）
- `--network-idle-time <ms>` - 网络空闲判定时间（默认 500ms）
- `--dom-stable-time <ms>` - DOM 稳定判定时间（默认 500ms）
- `--ignore <selectors>` - 忽略 DOM 变化的区域（逗号分隔）

**示例：**
```bash
# 等待页面完全空闲（网络 + DOM）
hab wait-idle

# 仅等待网络空闲（适用于有动画的页面）
hab wait-idle --strategy network

# 忽略广告区域的 DOM 变化
hab wait-idle --ignore ".ad-container,.chat-widget"

# 自定义超时和稳定时间
hab wait-idle --timeout 60000 --dom-stable-time 1000
```

---

### `wait-element` - 等待元素状态

等待特定元素出现、消失、可见或隐藏。

**语法：**
```bash
hab wait-element <selector> [options]
```

**选项：**
- `--state <state>` - 元素状态：attached, detached, visible, hidden（默认 visible）
- `--timeout <ms>` - 超时时间（默认 10000ms）

**状态说明：**
- `attached` - 元素存在于 DOM 中
- `detached` - 元素从 DOM 中移除
- `visible` - 元素可见（非 display:none/visibility:hidden）
- `hidden` - 元素隐藏

**示例：**
```bash
# 等待数据行出现
hab wait-element "css=.data-row" --state visible

# 等待加载动画消失
hab wait-element "css=.loading-spinner" --state detached

# 等待元素隐藏（如弹窗关闭）
hab wait-element "@e10" --state hidden --timeout 5000
```

---

## 数据提取命令

### `extract-table` - 提取表格数据

从 `<table>` 或 ARIA grid 中提取结构化数据。

**语法：**
```bash
hab extract-table [options]
```

**选项：**
- `--selector <selector>` - 表格选择器（不指定则自动查找第一个可见表格）
- `--no-headers` - 不包含表头
- `--max-rows <number>` - 最大行数（默认 1000）

**输出格式：**
```json
{
  "type": "table",
  "url": "https://example.com/users",
  "selector": "table.users-table",
  "timestamp": 1737446400000,
  "headers": ["姓名", "年龄", "城市"],
  "rows": 2,
  "data": [
    {"姓名": "张三", "年龄": "25", "城市": "北京"},
    {"姓名": "李四", "年龄": "30", "城市": "上海"}
  ]
}
```

**示例：**
```bash
# 提取页面上第一个表格
hab extract-table

# 提取指定表格
hab extract-table --selector "table.data-table"

# 限制行数
hab extract-table --max-rows 100

# 保存到文件
hab extract-table > table_data.json
```

---

### `extract-list` - 提取列表数据

从重复的 DOM 结构中提取列表数据（如商品列表、文章列表）。

**语法：**
```bash
hab extract-list [options]
```

**选项：**
- `--selector <selector>` - 列表容器选择器
- `--pattern <pattern>` - 列表项模式（默认 auto 自动检测）
- `--max-items <number>` - 最大条目数（默认 1000）

**输出格式：**
```json
{
  "type": "list",
  "url": "https://example.com/products",
  "selector": "ul.product-list",
  "timestamp": 1737446400000,
  "pattern": ".product-item",
  "items": 3,
  "data": [
    {
      "id": "prod_123",
      "title": "iPhone 15 Pro",
      "price": "¥8999",
      "description": "最新款苹果手机"
    }
  ]
}
```

**示例：**
```bash
# 自动检测列表结构
hab extract-list

# 指定容器和模式
hab extract-list --selector ".product-list" --pattern ".product-item"

# 限制条目数
hab extract-list --max-items 50
```

---

### `extract-form` - 提取表单数据

批量读取表单所有字段的当前状态。

**语法：**
```bash
hab extract-form [options]
```

**选项：**
- `--selector <selector>` - 表单选择器（不指定则查找第一个 form）
- `--include-disabled` - 包含禁用的字段

**输出格式：**
```json
{
  "type": "form",
  "url": "https://example.com/login",
  "selector": "form#login-form",
  "timestamp": 1737446400000,
  "fields": [
    {
      "name": "username",
      "type": "text",
      "value": "zhangsan",
      "label": "用户名",
      "placeholder": "请输入用户名",
      "required": true,
      "disabled": false
    }
  ]
}
```

**示例：**
```bash
# 提取表单状态
hab extract-form

# 提取指定表单
hab extract-form --selector "form#checkout"

# 包含禁用字段
hab extract-form --include-disabled
```

---

### `extract-meta` - 提取页面元数据

提取 SEO、Open Graph、Schema.org 等元数据。

**语法：**
```bash
hab extract-meta [options]
```

**选项：**
- `--include <types>` - 提取类型（默认全部）：seo,og,twitter,schema,other

**输出格式：**
```json
{
  "type": "metadata",
  "url": "https://example.com",
  "timestamp": 1737446400000,
  "seo": {
    "title": "页面标题",
    "description": "页面描述",
    "keywords": ["关键词1", "关键词2"]
  },
  "og": {
    "title": "分享标题",
    "image": "https://example.com/image.jpg"
  },
  "schema": [
    {"@type": "Article", "headline": "文章标题"}
  ]
}
```

**示例：**
```bash
# 提取所有元数据
hab extract-meta

# 仅提取 SEO 和 OG
hab extract-meta --include seo,og
```

---

## 网络监听命令

### `network-start` - 开始监听网络请求

拦截并记录网络请求（XHR/Fetch/等）。

**语法：**
```bash
hab network-start [options]
```

**选项：**
- `--filter <types>` - 资源类型：xhr,fetch,document,script,image,font（默认 xhr,fetch）
- `--url-pattern <pattern>` - URL glob 模式（如 `*/api/*`）
- `--methods <methods>` - HTTP 方法：GET,POST,PUT,DELETE

**输出：**
```json
{
  "listenerId": "listener_abc123",
  "session": "default",
  "filter": {
    "types": ["xhr", "fetch"],
    "urlPattern": "*/api/*"
  },
  "startTime": 1737446400000,
  "status": "active"
}
```

**示例：**
```bash
# 监听所有 XHR/Fetch 请求
hab network-start

# 仅监听 API 请求
hab network-start --filter xhr,fetch --url-pattern "*/api/*"

# 仅监听 POST 请求
hab network-start --methods POST
```

---

### `network-stop` - 停止监听并获取数据

停止网络监听并返回捕获的所有请求数据。

**语法：**
```bash
hab network-stop <listener-id>
```

**输出格式：**
```json
{
  "listenerId": "listener_abc123",
  "startTime": 1737446400000,
  "endTime": 1737446500000,
  "duration": 100000,
  "totalRequests": 5,
  "requests": [
    {
      "id": "req_1",
      "url": "https://api.example.com/users",
      "method": "GET",
      "request": {
        "headers": {"accept": "application/json"}
      },
      "response": {
        "status": 200,
        "body": {"users": [...]}
      },
      "timing": {
        "startTime": 1737446401000,
        "duration": 245
      }
    }
  ]
}
```

**示例：**
```bash
# 停止监听并获取数据
hab network-stop listener_abc123

# 保存到文件
hab network-stop listener_abc123 > api_data.json
```

---

## 使用场景示例

### 场景 1：翻页抓取表格数据

```bash
# 1. 打开列表页
hab open https://example.com/users

# 2. 获取第一页数据
hab extract-table > page1.json

# 3. 循环翻页
for i in {2..10}; do
  # 获取快照，找到"下一页"按钮
  hab snapshot -i | grep "下一页"  # 假设找到 @e25

  # 点击下一页
  hab click @e25

  # 等待页面空闲
  hab wait-idle --timeout 10000

  # 提取新数据
  hab extract-table > page${i}.json
done

# 4. 合并数据
jq -s '[.[] | .data[]] | {total: length, users: .}' page*.json > all_users.json
```

---

### 场景 2：无限滚动 + API 数据捕获

```bash
# 1. 打开页面
hab open https://example.com/products

# 2. 启动网络监听
LISTENER_ID=$(hab network-start --filter fetch --url-pattern "*/api/products*" | jq -r '.listenerId')

# 3. 循环滚动加载
for i in {1..5}; do
  # 滚动到底部
  hab scroll down --amount 1000

  # 等待加载动画消失
  hab wait-element "css=.loading" --state detached --timeout 5000

  # 等待 DOM 稳定
  hab wait-idle --strategy dom --timeout 3000
done

# 4. 停止监听，获取所有 API 响应
hab network-stop $LISTENER_ID > api_data.json

# 5. 提取页面上的列表（作为对比）
hab extract-list > dom_data.json
```

---

### 场景 3：表单自动填充验证

```bash
# 1. 打开表单页面
hab open https://example.com/register

# 2. 读取初始状态
hab extract-form > form_initial.json

# 3. 填写表单
hab fill @e1 "zhangsan"
hab fill @e2 "zhangsan@example.com"
hab fill @e3 "Password123!"

# 4. 验证填充成功
hab extract-form > form_filled.json
diff <(jq '.fields' form_initial.json) <(jq '.fields' form_filled.json)

# 5. 提交表单
hab click @e10

# 6. 等待成功消息
hab wait-element "text=注册成功" --timeout 5000
```

---

### 场景 4：SEO 数据批量提取

```bash
#!/bin/bash

URLS=(
  "https://example.com/page1"
  "https://example.com/page2"
  "https://example.com/page3"
)

for url in "${URLS[@]}"; do
  hab open "$url"
  hab wait-idle

  # 提取元数据
  filename="meta_$(echo $url | md5).json"
  hab extract-meta --include seo,og,schema > "$filename"
done

# 合并所有元数据
jq -s '.' meta_*.json > all_metadata.json
```

---

## 性能优化建议

### 1. 选择合适的等待策略

- **快速翻页**：`--strategy network`（忽略动画）
- **懒加载内容**：`--strategy both`（确保数据加载完成）
- **静态页面**：`--strategy dom`（无需等待网络）

### 2. 限制数据量

```bash
# 限制表格行数
hab extract-table --max-rows 100

# 限制列表条目
hab extract-list --max-items 50
```

### 3. 使用网络监听替代 DOM 解析

对于 SPA 应用，直接捕获 API 响应更高效：

```bash
# 不推荐：多次 DOM 提取
hab extract-list > data1.json
hab click @e5
hab wait-idle
hab extract-list > data2.json

# 推荐：一次性捕获所有 API 响应
LISTENER_ID=$(hab network-start --url-pattern "*/api/*" | jq -r '.listenerId')
# ... 执行操作 ...
hab network-stop $LISTENER_ID > all_api_data.json
```

---

## 错误处理

### 超时错误

```bash
# wait-idle 超时
{
  "error": "wait-idle timeout after 30000ms",
  "state": {
    "network": {
      "idle": false,
      "pendingRequests": 2
    },
    "dom": {
      "stable": false,
      "recentMutations": 15
    }
  }
}
```

**解决方案：**
- 增加超时时间：`--timeout 60000`
- 忽略慢请求：`--ignore ".ad-container"`
- 调整稳定时间：`--dom-stable-time 1000`

### 元素未找到

```bash
# wait-element 超时
{
  "error": "Element not visible after 10000ms",
  "selector": "css=.data-row",
  "currentState": {
    "attached": true,
    "visible": false,
    "computedStyle": {"display": "none"}
  }
}
```

**解决方案：**
- 检查选择器是否正确
- 使用 `hab snapshot -i` 查看当前元素
- 尝试等待 `attached` 状态而非 `visible`

---

## 完整工作流程示例

```bash
#!/bin/bash

# 电商网站商品数据抓取
SESSION="ecommerce"
URL="https://example.com/products"

# 1. 启动 Session
hab -s $SESSION open $URL

# 2. 提取页面元数据
hab -s $SESSION extract-meta --include seo,og > metadata.json

# 3. 启动网络监听
LISTENER_ID=$(hab -s $SESSION network-start \
  --filter fetch \
  --url-pattern "*/api/products*" | jq -r '.listenerId')

# 4. 翻页循环
for page in {1..10}; do
  echo "Processing page $page..."

  # 提取当前页数据
  hab -s $SESSION extract-list \
    --selector ".product-list" \
    --pattern ".product-item" > "products_page_${page}.json"

  # 查找下一页按钮
  NEXT_BTN=$(hab -s $SESSION snapshot -i | grep "下一页" | awk '{print $1}')

  if [ -z "$NEXT_BTN" ]; then
    echo "No more pages"
    break
  fi

  # 点击下一页
  hab -s $SESSION click $NEXT_BTN

  # 等待页面加载
  hab -s $SESSION wait-idle --timeout 10000
done

# 5. 停止网络监听
hab -s $SESSION network-stop $LISTENER_ID > api_requests.json

# 6. 合并数据
jq -s '[.[] | .data[]]' products_page_*.json > all_products.json

# 7. 关闭 Session
hab -s $SESSION close

echo "Done! Total products: $(jq '. | length' all_products.json)"
```

---

## 最佳实践

1. **优先使用 `@eN` 引用**
   ```bash
   hab snapshot -i
   hab click @e5  # 比 css 选择器更稳定
   ```

2. **合理设置超时**
   ```bash
   # 快速页面
   hab wait-idle --timeout 5000

   # 慢速 API
   hab wait-idle --timeout 60000
   ```

3. **分批处理大数据**
   ```bash
   # 每次处理 100 条
   for offset in {0..1000..100}; do
     hab extract-table --max-rows 100 > "batch_${offset}.json"
     # 处理数据...
   done
   ```

4. **使用 Session 隔离**
   ```bash
   # 不同任务使用不同 Session
   hab -s task1 open https://site1.com
   hab -s task2 open https://site2.com
   ```

---

## 故障排查

### 问题：表格提取为空

**原因：**
- 表格使用 JavaScript 动态渲染
- 表格在 Shadow DOM 中

**解决：**
```bash
# 确保页面加载完成
hab wait-idle --strategy both

# 尝试 ARIA table
hab extract-table --selector '[role="grid"]'
```

### 问题：列表项检测失败

**原因：**
- DOM 结构不规则
- 列表项 class 名称动态生成

**解决：**
```bash
# 手动指定模式
hab extract-list --pattern "css=.item-12345"

# 使用更宽泛的选择器
hab extract-list --pattern "[class*='item']"
```

### 问题：网络监听未捕获请求

**原因：**
- 请求类型不在过滤器中
- URL 模式不匹配

**解决：**
```bash
# 扩大过滤范围
hab network-start --filter xhr,fetch,document

# 使用更宽泛的 URL 模式
hab network-start --url-pattern "*"
```

---

## 相关文档

- [README.md](../README.md) - 项目概览
- [CLAUDE.md](../CLAUDE.md) - 开发者指南
- [hab.skill.md](../skills/hyper-agent-browser.md) - AI Agent Skill 文档
