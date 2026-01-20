# 数据提取能力扩展设计方案

**日期**: 2026-01-21
**作者**: Hubert
**状态**: 已批准，待实施

## 需求概述

扩展 hyper-agent-browser 的页面数据获取能力，支持：

1. **结构化数据提取**（表格/列表/JSON）
2. **页面元数据提取**（meta 标签/OG 标签/SEO 信息）
3. **表单状态批量读取**（所有 input 的值）
4. **网络请求数据拦截**（XHR/Fetch 响应）
5. **翻页与懒加载支持**（自动化多页抓取）

## 设计原则

- **手动循环模式**：AI Agent 控制翻页逻辑，CLI 提供原子操作
- **符合项目理念**："AI 决策 + CLI 确定性操作"分离
- **输出格式统一**：所有 extract 命令返回带元数据的 JSON 结构
- **可复用底层能力**：等待、监听等能力可用于其他场景

---

## 一、整体架构

### 新增命令模块

#### 1. `src/commands/extract.ts`

提供 4 个数据提取命令：

- **`hab extract-table`** - 提取表格数据（`<table>` 或 ARIA grid）
- **`hab extract-list`** - 提取列表数据（`<ul>`/`<ol>` 或重复结构）
- **`hab extract-meta`** - 提取页面元数据（meta/og/schema.org）
- **`hab extract-form`** - 批量读取表单状态

#### 2. `src/commands/network.ts`

提供 2 个网络监听命令：

- **`hab network-start`** - 开始监听网络请求（返回监听 ID）
- **`hab network-stop <id>`** - 停止监听并返回捕获的数据

#### 3. `src/commands/wait.ts`

提供 2 个等待命令：

- **`hab wait-idle`** - 等待页面空闲（网络+DOM 稳定）
- **`hab wait-element <selector>`** - 等待元素出现/消失

### 底层支持模块

新增 `src/extractors/` 目录：

```
src/extractors/
├── table-extractor.ts    # 表格解析逻辑
├── list-extractor.ts     # 列表模式识别
├── meta-extractor.ts     # 元数据提取
└── form-extractor.ts     # 表单状态读取
```

网络监听状态持久化：
- 监听器状态存入 `~/.hab/sessions/{session}/network/{id}.json`
- 请求数据实时追加到文件
- 支持跨 CLI 调用复用监听器

---

## 二、结构化数据提取

### 2.1 表格提取（`extract-table`）

#### CLI 接口

```bash
hab extract-table [selector] [options]

Options:
  --headers              # 包含表头（默认 true）
  --max-rows <number>    # 最大行数（默认无限制）
  -s, --session <name>   # Session 名称
```

#### 实现策略

1. **识别表格**：
   - 优先匹配 `<table>` 标签（语义化 HTML）
   - 回退到 ARIA 标记（`role="table"` 或 `role="grid"`）
   - 如果提供 selector，在该范围内查找

2. **提取表头**：
   - 标准方式：`<thead>` 或 `<th>` 标签
   - 智能推断：首行 font-weight > 600 或特殊背景色
   - 无表头时：生成列名 `column_1`, `column_2`...

3. **处理特殊情况**：
   - **合并单元格**：`colspan`/`rowspan` 展开为多条记录
   - **隐藏行**：过滤 `display:none` 或 `visibility:hidden`
   - **嵌套表格**：只提取最外层，内层作为字段值

4. **数据清洗**：
   - 去除前后空白字符
   - 移除换行符（保留单个空格）
   - 处理 `&nbsp;` 等 HTML 实体

#### 输出格式

```json
{
  "type": "table",
  "url": "https://example.com/users",
  "selector": "table.data-table",
  "timestamp": 1737446400000,
  "headers": ["姓名", "年龄", "城市"],
  "rows": 2,
  "data": [
    {"姓名": "张三", "年龄": "25", "城市": "北京"},
    {"姓名": "李四", "年龄": "30", "城市": "上海"}
  ]
}
```

---

### 2.2 列表提取（`extract-list`）

#### CLI 接口

```bash
hab extract-list [selector] [options]

Options:
  --pattern <auto|manual>  # 自动检测或手动指定重复模式（默认 auto）
  --max-items <number>     # 最大条目数（默认无限制）
  -s, --session <name>     # Session 名称
```

#### 实现策略

1. **检测重复结构**：
   - 查找相同 class 的兄弟元素（如 `.product-item`）
   - 分析 DOM 结构相似度（标签层级、class 模式）
   - 支持嵌套列表（商品列表 > 评论列表）

2. **字段提取**：
   - 自动识别：提取每个 item 内的文本节点和属性
   - 命名规则：使用 class 名或 data-* 属性作为字段名
   - 多值字段：数组形式保存（如标签列表）

3. **去重处理**：
   - 检测 `data-id`/`id` 属性
   - 懒加载场景：记录已提取的 ID，跨调用去重

4. **结构化输出**：
   - 每个 item 转换为对象
   - 保留嵌套结构（如评论在商品下）

#### 输出格式

```json
{
  "type": "list",
  "url": "https://example.com/products",
  "selector": "div.product-list",
  "timestamp": 1737446400000,
  "pattern": ".product-item",
  "items": 3,
  "data": [
    {
      "id": "prod_123",
      "title": "商品A",
      "price": "99.00",
      "tags": ["热销", "新品"]
    },
    {
      "id": "prod_124",
      "title": "商品B",
      "price": "149.00",
      "tags": ["推荐"]
    }
  ]
}
```

---

## 三、元数据与表单提取

### 3.1 元数据提取（`extract-meta`）

#### CLI 接口

```bash
hab extract-meta [options]

Options:
  --include <types>      # 提取类型：seo,og,schema,twitter（默认全部）
  -s, --session <name>   # Session 名称
```

#### 提取内容

1. **SEO 基础元数据**：
   - `<title>` 标签内容
   - `<meta name="description">`
   - `<meta name="keywords">`
   - `<link rel="canonical">`
   - `<meta name="robots">`

2. **Open Graph 协议**（社交分享）：
   - `og:title`, `og:description`, `og:image`
   - `og:type`, `og:url`, `og:site_name`

3. **Twitter Cards**：
   - `twitter:card`, `twitter:site`
   - `twitter:title`, `twitter:image`

4. **Schema.org 结构化数据**：
   - 解析 `<script type="application/ld+json">`
   - 提取常见类型：Product, Article, Event, Organization

5. **其他元数据**：
   - `<meta charset>`, `<meta name="viewport">`
   - `<html lang>` 属性
   - `<meta name="author">`

#### 输出格式

```json
{
  "type": "metadata",
  "url": "https://example.com/article",
  "timestamp": 1737446400000,
  "seo": {
    "title": "示例文章标题",
    "description": "这是文章描述",
    "keywords": ["关键词1", "关键词2"],
    "canonical": "https://example.com/article",
    "robots": "index,follow"
  },
  "og": {
    "title": "分享标题",
    "description": "分享描述",
    "image": "https://example.com/image.jpg",
    "type": "article",
    "url": "https://example.com/article"
  },
  "twitter": {
    "card": "summary_large_image",
    "site": "@example"
  },
  "schema": [
    {
      "@type": "Article",
      "headline": "文章标题",
      "author": {"@type": "Person", "name": "作者"},
      "datePublished": "2026-01-21"
    }
  ],
  "other": {
    "charset": "UTF-8",
    "viewport": "width=device-width, initial-scale=1",
    "lang": "zh-CN"
  }
}
```

---

### 3.2 表单提取（`extract-form`）

#### CLI 接口

```bash
hab extract-form [selector] [options]

Options:
  --include-disabled     # 包含禁用的字段（默认 false）
  -s, --session <name>   # Session 名称
```

#### 提取逻辑

1. **定位表单容器**：
   - 如果提供 selector，在该范围查找所有表单控件
   - 否则默认提取页面上所有 `<form>` 元素

2. **遍历表单控件**：
   - `<input>` 所有类型（text/password/email/checkbox/radio/hidden）
   - `<textarea>`
   - `<select>` 和 `<option>`

3. **读取控件状态**：
   - **文本输入**：`value` 属性
   - **复选框/单选框**：`checked` 状态
   - **下拉框**：`selectedOptions` 的值和文本
   - **隐藏字段**：`value`（可选）

4. **关联元数据**：
   - `name` 属性（表单提交的字段名）
   - `type` 属性
   - `required`/`disabled`/`readonly` 状态
   - `placeholder` 提示文本
   - 关联的 `<label>`（通过 `for` 属性或父子关系）

5. **引用快照元素**：
   - 如果字段在最近的 snapshot 中，添加 `@eN` 引用
   - 便于后续 `fill`/`click` 操作

#### 输出格式

```json
{
  "type": "form",
  "url": "https://example.com/login",
  "selector": "form#login-form",
  "timestamp": 1737446400000,
  "fields": [
    {
      "ref": "@e12",
      "name": "username",
      "type": "text",
      "value": "zhangsan",
      "label": "用户名",
      "placeholder": "请输入用户名",
      "required": true,
      "disabled": false
    },
    {
      "ref": "@e13",
      "name": "password",
      "type": "password",
      "value": "******",
      "label": "密码",
      "required": true,
      "disabled": false
    },
    {
      "ref": "@e14",
      "name": "remember",
      "type": "checkbox",
      "checked": true,
      "label": "记住我",
      "required": false
    }
  ]
}
```

---

## 四、网络请求监听

### 4.1 监听机制设计

使用 **Patchright 的 CDP（Chrome DevTools Protocol）** 监听网络事件，在 Session 级别持久化监听器状态。

#### 工作流程

1. **启动监听**：
   ```bash
   hab network-start --filter xhr,fetch --url-pattern "*/api/*"
   # 输出: listener_abc123
   ```
   - 创建监听器，记录配置到 Session
   - 返回唯一 ID（用于后续引用）

2. **执行操作**（翻页/点击等）：
   ```bash
   hab click @e5
   hab wait-idle
   ```
   - 浏览器继续运行，监听器在后台捕获请求

3. **停止监听并获取数据**：
   ```bash
   hab network-stop listener_abc123
   ```
   - 停止监听器
   - 返回捕获的所有请求数据
   - 清理临时文件

---

### 4.2 过滤器配置

#### CLI 接口

```bash
hab network-start [options]

Options:
  --filter <types>          # 资源类型：xhr,fetch,document,script,image,font（默认 xhr,fetch）
  --url-pattern <pattern>   # URL glob 模式，如 "*/api/*" 或 "https://example.com/**"
  --method <methods>        # HTTP 方法：GET,POST,PUT,DELETE（默认全部）
  -s, --session <name>      # Session 名称
```

#### 过滤规则

1. **资源类型过滤**：
   - `xhr`：XMLHttpRequest
   - `fetch`：Fetch API
   - `document`：HTML 文档
   - `script`：JavaScript 文件
   - `image`：图片资源
   - `font`：字体文件

2. **URL 模式匹配**：
   - 使用 minimatch 库进行 glob 匹配
   - 示例：`*/api/*` 匹配所有包含 `/api/` 的 URL
   - 示例：`https://api.example.com/**` 匹配特定域名

3. **HTTP 方法过滤**：
   - 支持 GET/POST/PUT/DELETE/PATCH
   - 多个方法用逗号分隔

---

### 4.3 数据捕获

#### 捕获内容

对每个匹配的请求，记录：

1. **Request 信息**：
   - `url`: 完整 URL
   - `method`: HTTP 方法
   - `headers`: 请求头（对象格式）
   - `postData`: POST 请求体（自动解析 JSON）

2. **Response 信息**：
   - `status`: HTTP 状态码
   - `statusText`: 状态描述
   - `headers`: 响应头
   - `body`: 响应体（JSON 自动解析，其他保持原始格式）

3. **Timing 信息**：
   - `startTime`: 请求开始时间（Unix 时间戳）
   - `endTime`: 响应完成时间
   - `duration`: 持续时间（毫秒）

#### 存储策略

1. **监听器状态文件**：
   - 位置：`~/.hab/sessions/{session}/network/{id}/meta.json`
   - 内容：过滤器配置、启动时间、状态（active/stopped）

2. **请求数据文件**：
   - 位置：`~/.hab/sessions/{session}/network/{id}/requests.jsonl`
   - 格式：JSON Lines（每行一个请求对象）
   - 实时追加（支持长时间监听）

3. **自动清理**：
   - 监听超过 1 小时自动停止
   - 数据超过 100MB 自动停止
   - Session 关闭时清理所有监听器

---

### 4.4 输出格式

#### `network-start` 输出

```json
{
  "listenerId": "listener_abc123",
  "session": "default",
  "filter": {
    "types": ["xhr", "fetch"],
    "urlPattern": "*/api/*",
    "methods": ["GET", "POST"]
  },
  "startTime": 1737446400000,
  "status": "active"
}
```

#### `network-stop` 输出

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
        "headers": {
          "accept": "application/json",
          "authorization": "Bearer xxx"
        }
      },
      "response": {
        "status": 200,
        "statusText": "OK",
        "headers": {
          "content-type": "application/json"
        },
        "body": {
          "users": [
            {"id": 1, "name": "张三"},
            {"id": 2, "name": "李四"}
          ]
        }
      },
      "timing": {
        "startTime": 1737446401000,
        "endTime": 1737446401245,
        "duration": 245
      }
    },
    {
      "id": "req_2",
      "url": "https://api.example.com/products",
      "method": "POST",
      "request": {
        "headers": {
          "content-type": "application/json"
        },
        "postData": {
          "page": 2,
          "limit": 20
        }
      },
      "response": {
        "status": 200,
        "body": {
          "products": [...]
        }
      },
      "timing": {
        "startTime": 1737446402000,
        "endTime": 1737446402180,
        "duration": 180
      }
    }
  ]
}
```

---

## 五、等待与空闲检测

### 5.1 等待空闲（`wait-idle`）

#### CLI 接口

```bash
hab wait-idle [options]

Options:
  --timeout <ms>              # 超时时间（默认 30000ms）
  --strategy <strategies>     # 策略：network,dom,both（默认 both）
  --network-idle-time <ms>    # 网络空闲判定时间（默认 500ms）
  --dom-stable-time <ms>      # DOM 稳定判定时间（默认 500ms）
  --ignore <selectors>        # 忽略的 DOM 区域（逗号分隔）
  -s, --session <name>        # Session 名称
```

---

#### 策略详解

##### 1. 网络空闲（`network`）

**判定条件**：
- 500ms 内无新的网络请求发起
- 所有进行中的请求已完成（status 2xx/4xx/5xx）

**监听资源类型**：
- XHR（XMLHttpRequest）
- Fetch API
- 图片（Image）
- 脚本（Script）
- 样式表（Stylesheet）

**排除规则**：
- WebSocket 连接（持久连接）
- EventSource（Server-Sent Events）
- 通过 `--exclude-url` 参数指定的 URL 模式（如广告/统计脚本）

**实现方式**：
- 使用 Patchright 的 `page.waitForLoadState('networkidle')`
- 自定义 CDP 监听（更精细控制）

---

##### 2. DOM 稳定（`dom`）

**判定条件**：
- 500ms 内无 DOM 节点增删
- 无元素属性变化（可选，通过 `--strict` 开启）

**监听方式**：
- 使用 `MutationObserver` API
- 监听 `childList`（子节点增删）
- 监听 `subtree`（整个子树变化）
- 可选监听 `attributes`（属性变化，严格模式）

**忽略区域**：
通过 `--ignore` 参数指定忽略的选择器，常见场景：
- 广告容器：`.ad-container, .google-ads`
- 聊天组件：`#chat-widget, .intercom-container`
- 动画元素：`.animated, .spinner`

**实现方式**：
```javascript
page.evaluate(() => {
  return new Promise((resolve) => {
    let timer;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
});
```

---

##### 3. 组合策略（`both`，默认）

**判定条件**：
- 同时满足网络空闲 **和** DOM 稳定
- 适用于大部分翻页/懒加载场景

**执行顺序**：
1. 并行启动网络监听和 DOM 监听
2. 两者都满足条件时返回
3. 超时后抛出异常，包含当前状态信息

---

#### 超时处理

**超时输出示例**：
```json
{
  "error": "wait-idle timeout after 30000ms",
  "state": {
    "network": {
      "idle": false,
      "pendingRequests": 2,
      "lastRequestTime": 1737446429500,
      "requests": [
        {"url": "https://example.com/api/slow", "duration": 25000},
        {"url": "https://analytics.com/track", "duration": 10000}
      ]
    },
    "dom": {
      "stable": false,
      "lastMutationTime": 1737446429800,
      "recentMutations": 15
    }
  }
}
```

**调试建议**：
- 检查 `pendingRequests`，考虑添加 `--exclude-url` 排除慢请求
- 检查 `recentMutations`，考虑添加 `--ignore` 忽略动画区域
- 降低稳定时间：`--network-idle-time 1000 --dom-stable-time 1000`

---

### 5.2 等待元素（`wait-element`）

#### CLI 接口

```bash
hab wait-element <selector> [options]

Options:
  --state <state>         # 等待状态：attached,detached,visible,hidden（默认 visible）
  --timeout <ms>          # 超时时间（默认 10000ms）
  -s, --session <name>    # Session 名称
```

---

#### 支持的状态

1. **`attached`**：
   - 元素存在于 DOM 树中
   - 不考虑可见性
   - 用途：等待动态插入的元素

2. **`detached`**：
   - 元素从 DOM 树中移除
   - 用途：等待加载动画/弹窗消失

3. **`visible`**（默认）：
   - 元素存在且可见
   - 判定条件：
     - 非 `display: none`
     - 非 `visibility: hidden`
     - 非 `opacity: 0`（可选，通过 `--strict` 开启）
     - 尺寸 > 0（宽高都不为 0）
   - 用途：等待内容加载完成

4. **`hidden`**：
   - 元素存在但不可见
   - 判定条件：与 `visible` 相反
   - 用途：等待元素隐藏（如关闭动画完成）

---

#### 选择器支持

支持所有现有选择器格式：

1. **快照引用**：`@e5`（需要在同一 Session 中先执行 `snapshot`）
2. **CSS 选择器**：`css=.loading-spinner`
3. **文本匹配**：`text=加载中...`
4. **XPath**：`xpath=//div[@class='loader']`

---

#### 实现方式

使用 Patchright 的 Locator API：

```typescript
const locator = parseSelector(selector); // 解析选择器
await locator.waitFor({ state: 'visible', timeout: 10000 });
```

---

#### 超时处理

**超时输出示例**：
```json
{
  "error": "Element not visible after 10000ms",
  "selector": "css=.data-row",
  "state": "visible",
  "currentState": {
    "attached": true,
    "visible": false,
    "boundingBox": null,
    "computedStyle": {
      "display": "none"
    }
  }
}
```

---

## 六、Agent 使用示例

### 场景 1：翻页抓取表格数据

```bash
# 1. 打开列表页
hab open https://example.com/users

# 2. 获取第一页数据
hab extract-table --max-rows 50 > page1.json

# 3. 循环翻页
for i in {2..10}; do
  # 获取当前页快照，找到"下一页"按钮
  hab snapshot -i | grep "下一页" # 假设找到 @e25

  # 点击下一页
  hab click @e25

  # 等待页面空闲（网络请求完成 + DOM 稳定）
  hab wait-idle --timeout 10000

  # 提取新数据
  hab extract-table --max-rows 50 > page${i}.json
done

# 4. 合并数据（外部脚本）
jq -s '[.[] | .data[]] | {total: length, users: .}' page*.json > all_users.json
```

---

### 场景 2：无限滚动列表

```bash
# 1. 打开页面
hab open https://example.com/products

# 2. 启动网络监听（捕获 API 响应）
hab network-start --filter fetch --url-pattern "*/api/products*" > listener.json
LISTENER_ID=$(jq -r '.listenerId' listener.json)

# 3. 循环滚动加载
for i in {1..5}; do
  # 滚动到页面底部
  hab scroll-to "css=footer"

  # 等待加载动画消失
  hab wait-element "css=.loading-spinner" --state detached --timeout 5000

  # 等待 DOM 稳定（新商品渲染完成）
  hab wait-idle --strategy dom --timeout 3000
done

# 4. 停止监听，获取所有 API 响应
hab network-stop $LISTENER_ID > api_data.json

# 5. 提取页面上的商品列表（作为对比/补充）
hab extract-list "css=.product-list" > dom_data.json
```

---

### 场景 3：表单自动填充验证

```bash
# 1. 打开表单页面
hab open https://example.com/register

# 2. 读取当前表单状态（检查预填充）
hab extract-form > form_initial.json

# 3. 填写表单
hab fill @e1 "zhangsan"         # 用户名
hab fill @e2 "zhangsan@example.com"  # 邮箱
hab fill @e3 "Password123!"     # 密码

# 4. 再次读取表单状态（验证填充成功）
hab extract-form > form_filled.json

# 5. 对比差异（外部脚本）
diff <(jq '.fields' form_initial.json) <(jq '.fields' form_filled.json)

# 6. 提交表单
hab click @e10  # 提交按钮

# 7. 等待提交完成（成功消息出现）
hab wait-element "text=注册成功" --timeout 5000
```

---

### 场景 4：SEO 数据批量提取

```bash
# URL 列表
URLS=(
  "https://example.com/page1"
  "https://example.com/page2"
  "https://example.com/page3"
)

# 循环提取元数据
for url in "${URLS[@]}"; do
  hab open "$url"
  hab wait-idle

  # 提取 SEO 元数据
  hab extract-meta --include seo,og,schema > "meta_$(echo $url | md5).json"
done

# 合并所有元数据
jq -s '.' meta_*.json > all_metadata.json
```

---

## 七、实施计划

### Phase 1：等待命令（基础能力）

**优先级**：最高（其他功能依赖）

**任务**：
1. 实现 `wait-idle` 命令
   - 网络空闲策略（复用 Playwright 的 `networkidle`）
   - DOM 稳定策略（MutationObserver）
   - 组合策略和超时处理
2. 实现 `wait-element` 命令
   - 支持 4 种状态（attached/detached/visible/hidden）
   - 复用现有 selector 解析逻辑
3. 编写单元测试和集成测试

**预计时间**：2-3 天

---

### Phase 2：结构化数据提取

**优先级**：高

**任务**：
1. 实现 `extract-table` 命令
   - TableExtractor 类（表格识别和解析）
   - 处理合并单元格、隐藏行
   - 输出格式化为 JSON
2. 实现 `extract-list` 命令
   - ListExtractor 类（重复结构检测）
   - 字段自动识别
   - 支持嵌套列表
3. 实现 `extract-form` 命令
   - FormExtractor 类（表单控件遍历）
   - 读取各类控件状态
   - 关联 label 和快照引用
4. 编写测试用例

**预计时间**：4-5 天

---

### Phase 3：元数据提取

**优先级**：中

**任务**：
1. 实现 `extract-meta` 命令
   - MetaExtractor 类（提取 SEO/OG/Schema.org）
   - 解析 JSON-LD 结构化数据
   - 支持选择性提取（--include 参数）
2. 编写测试用例

**预计时间**：2 天

---

### Phase 4：网络监听

**优先级**：中高

**任务**：
1. 实现 `network-start` 命令
   - 使用 CDP 监听网络事件
   - 过滤器配置（类型/URL/方法）
   - 持久化监听器状态到 Session
2. 实现 `network-stop` 命令
   - 停止监听器
   - 读取并格式化请求数据
   - 清理临时文件
3. 实现监听器生命周期管理
   - 自动超时清理
   - Session 关闭时清理
4. 编写测试用例

**预计时间**：3-4 天

---

### Phase 5：文档和示例

**优先级**：中

**任务**：
1. 更新 `README.md`（新命令说明）
2. 编写 `EXTRACTION_GUIDE.md`（提取能力使用指南）
3. 更新 `hab.skill.md`（Skill 文档，供 AI Agent 使用）
4. 添加使用示例到 `examples/` 目录
5. 更新 CLAUDE.md（架构说明）

**预计时间**：2 天

---

### 总预计时间

**13-16 工作日**（约 2-3 周）

---

## 八、技术细节

### 8.1 依赖库

无需新增外部依赖，复用现有技术栈：

- **Patchright**：提供 CDP 访问、Locator API、MutationObserver
- **Zod**：验证命令行参数和输出格式
- **Bun**：运行时和文件 I/O

---

### 8.2 错误处理

#### 自定义错误类

```typescript
// src/errors/extraction-errors.ts

export class ExtractionError extends HBAError {
  code = 'EXTRACTION_ERROR';
}

export class TableNotFoundError extends ExtractionError {
  code = 'TABLE_NOT_FOUND';
  hint = "No table found. Use 'hab snapshot' to inspect the page structure.";
}

export class NetworkListenerError extends HBAError {
  code = 'NETWORK_LISTENER_ERROR';
}

export class WaitTimeoutError extends HBAError {
  code = 'WAIT_TIMEOUT';
  // hint will include current state information
}
```

#### 错误退出码

- `0`：成功
- `1`：一般错误
- `2`：参数错误
- `3`：Session 错误
- `4`：浏览器错误
- `5`：元素错误
- `6`：超时错误
- `7`：提取错误（新增）

---

### 8.3 性能优化

1. **流式处理**：
   - 大数据表格分批输出（每 100 行一批）
   - 网络监听使用 JSON Lines 格式（实时追加）

2. **内存限制**：
   - 单次提取最大 10000 条记录（可配置）
   - 网络监听数据超过 100MB 自动停止

3. **缓存策略**：
   - 表单提取复用 snapshot 中的元素引用
   - 避免重复查询 DOM

---

### 8.4 测试策略

#### 单元测试

- `extractors/*.test.ts`：测试各个 Extractor 类
- `commands/*.test.ts`：测试命令参数解析和逻辑

#### 集成测试

- 使用本地 HTML 文件测试（`tests/fixtures/`）
- 模拟各种表格/列表/表单结构
- 验证输出格式和数据正确性

#### E2E 测试

- 使用真实网站（如 example.com、httpbin.org）
- 测试网络监听和等待命令
- 验证跨 CLI 调用的状态持久化

---

## 九、风险与限制

### 风险

1. **动态渲染网站**：
   - 部分网站使用 Shadow DOM 或 Canvas 渲染
   - 缓解：优先提取可访问性树，回退到 DOM

2. **反爬虫机制**：
   - 频繁请求可能触发限流/封禁
   - 缓解：文档中提示用户添加延迟（`hab wait 2000`）

3. **网络监听性能**：
   - 长时间监听可能产生大量数据
   - 缓解：自动超时清理 + 文件大小限制

### 限制

1. **不支持多标签页**（当前版本，v1.1 计划支持）
2. **JSON 格式输出**（暂不支持 CSV/Excel）
3. **网络监听不支持修改请求**（仅读取，不支持 Mock）

---

## 十、后续优化方向

### v1.1 功能

1. **智能字段映射**：
   - 表格提取自动识别日期/数字/链接字段
   - 类型转换和验证

2. **增量提取**：
   - 记录已提取的数据 ID
   - 跨 Session 去重

3. **导出格式扩展**：
   - 支持 CSV/Excel/Markdown 输出
   - 命令：`hab export --format csv data.json`

### v1.2 功能

1. **多标签页支持**：
   - 网络监听跨标签页
   - 批量提取多个标签页数据

2. **高级过滤器**：
   - 数据提取支持 JSONPath/JMESPath 过滤
   - 命令：`hab extract-table --filter ".data[?price > 100]"`

---

## 附录：文件结构

```
src/
├── commands/
│   ├── extract.ts          # 新增：数据提取命令
│   ├── network.ts          # 新增：网络监听命令
│   └── wait.ts             # 新增：等待命令
├── extractors/
│   ├── table-extractor.ts  # 新增：表格提取逻辑
│   ├── list-extractor.ts   # 新增：列表提取逻辑
│   ├── meta-extractor.ts   # 新增：元数据提取逻辑
│   └── form-extractor.ts   # 新增：表单提取逻辑
├── errors/
│   └── extraction-errors.ts # 新增：提取相关错误类
└── utils/
    └── network-listener.ts  # 新增：网络监听工具

tests/
├── fixtures/
│   ├── table.html          # 测试用表格页面
│   ├── list.html           # 测试用列表页面
│   ├── form.html           # 测试用表单页面
│   └── metadata.html       # 测试用元数据页面
└── integration/
    ├── extract.test.ts
    ├── network.test.ts
    └── wait.test.ts

docs/
└── EXTRACTION_GUIDE.md     # 新增：提取能力使用指南

~/.hab/sessions/{session}/
└── network/
    └── {listener_id}/
        ├── meta.json       # 监听器配置
        └── requests.jsonl  # 请求数据
```

---

## 总结

本设计方案扩展了 hyper-agent-browser 的数据获取能力，新增 9 个命令，覆盖结构化数据提取、元数据读取、网络监听、等待控制等场景。所有设计遵循项目的"AI 决策 + CLI 确定性操作"理念，输出格式统一为带元数据的 JSON，便于 AI Agent 理解和处理。

预计实施周期 2-3 周，分 5 个阶段递进完成，优先实现基础等待能力，再逐步添加提取和监听功能。
