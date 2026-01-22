# hyper-agent-browser Skill 增强规格书

## 概述

当前 hyper-agent-browser (hab) 已具备基础的浏览器自动化能力。本规格书定义下一阶段的 Skill 增强方向，目标是让 AI Agent 更智能、更自主地完成各类浏览器任务。

## 设计原则

1. **代码层保持简单**：hab CLI 只负责浏览器操作，不包含业务逻辑
2. **Skill 层负责智能**：登录检测、重试策略、工作流编排等由 Skill 定义
3. **用户可配置**：关键行为支持配置覆盖，满足不同场景需求
4. **渐进增强**：按优先级迭代，每个能力独立可用

---

## 一、能力增强型 Skills

### 1.1 智能登录检测 (P0)

#### 功能描述

Agent 使用 hab 访问需要登录的页面时，自动检测登录状态并处理。

#### 检测规则

以下任一条件满足即判定为"需要登录"：

```
1. URL 包含登录相关路径：/login, /signin, /auth, /sso
2. 页面被重定向到登录页（redirect_after_login 参数）
3. snapshot 显示登录表单元素（用户名、密码输入框 + 登录按钮）
4. 页面标题包含：登录、Login、Sign in
```

#### 行为模式

| 模式 | 配置值 | 行为 |
|------|--------|------|
| **自动模式** | `auto`（默认） | 检测到登录页 → 自动切换 headed → 轮询等待登录完成 → 自动切回 headless |
| **确认模式** | `confirm` | 检测到登录页 → 询问用户确认 → 用户同意后切换 → 登录后再次确认 |

#### Skill 配置格式

```yaml
---
loginDetection:
  mode: auto | confirm
  pollInterval: 60000      # 轮询间隔（毫秒）
  maxWaitTime: 600000      # 最大等待时间（10分钟）
---
```

#### 执行流程

**自动模式：**

```
1. hab open <url>
2. hab wait 3000
3. hab snapshot -i → 分析是否为登录页
4. 如果是登录页：
   a. hab close（关闭当前 headless 浏览器）
   b. 启动 headed 浏览器打开登录页
   c. 每 60s 检查 URL 是否离开登录页
   d. 检测到登录成功 → 关闭 headed 浏览器
   e. hab open <原目标URL>（headless 模式，复用登录态）
5. 继续执行原任务
```

**确认模式：**

```
1-3. 同上
4. 如果是登录页：
   a. AskUserQuestion: "检测到需要登录，是否打开浏览器窗口？"
   b. 用户确认 → 执行自动模式的 a-d 步骤
   c. AskUserQuestion: "登录完成了吗？"
   d. 用户确认 → 继续任务
```

#### 用户覆盖示例

```markdown
# my-bank-workflow

---
loginDetection:
  mode: confirm  # 银行操作需要用户明确确认
---

## 任务
处理银行网站的自动化操作...
```

---

### 1.2 智能等待策略 (P1)

#### 功能描述

自动判断页面加载完成，而非使用固定的 `hab wait <ms>`。

#### 等待规则

```
1. 网络空闲：无新请求超过 500ms
2. DOM 稳定：无 DOM 变化超过 500ms
3. 关键元素出现：目标元素可见
```

#### 使用方式

```bash
# 当前方式（固定等待）
hab wait 3000

# 增强方式（智能等待）
hab wait-idle                    # 等待网络+DOM稳定
hab wait-element @e5             # 等待特定元素出现
hab wait-element @e5 --hidden    # 等待元素消失
```

#### Skill 指导

```markdown
## 等待策略

优先使用智能等待：
- 页面加载后：`hab wait-idle`
- 等待特定操作完成：`hab wait-element <目标元素>`
- 仅当上述方法不适用时才使用 `hab wait <ms>`
```

---

### 1.3 操作重试策略 (P1)

#### 功能描述

操作失败时自动重试，包含降级策略。

#### 重试规则

| 错误类型 | 重试策略 |
|----------|----------|
| 元素未找到 | 等待 2s → 刷新 snapshot → 重试 |
| 点击被拦截 | force click → dispatchEvent（已实现） |
| 超时 | 增加超时时间重试 |
| 网络错误 | 等待 5s → 重试 |

#### Skill 指导

```markdown
## 重试策略

操作失败时按以下顺序处理：
1. 元素未找到 → `hab snapshot -i` 刷新 → 重新定位
2. 点击失败 → hab 自动降级（已内置）
3. 连续失败 3 次 → 报告错误，询问用户
```

---

### 1.4 验证码处理 (P2)

#### 功能描述

检测到验证码时暂停任务，提示用户手动处理。

#### 检测规则

```
1. 页面包含 CAPTCHA 相关元素
2. 页面包含 reCAPTCHA/hCaptcha iframe
3. snapshot 显示验证码图片
```

#### 行为

```
检测到验证码 → 切换 headed 模式 → 提示用户手动完成 → 用户确认 → 继续任务
```

---

## 二、场景集成型 Skills

### 2.1 文件下载 (P0)

#### 功能描述

新增 `hab download` 命令，支持下载文件。

#### 命令设计

```bash
hab download <selector>              # 点击下载链接/按钮
hab download <selector> -o <path>    # 指定保存路径
hab download-url <url> -o <path>     # 直接下载 URL
```

#### 实现方式

利用浏览器原生下载能力：
1. 设置下载目录
2. 触发下载（点击或 navigation）
3. 等待下载完成
4. 返回文件路径

#### 优势

- 自动携带登录态（Cookies）
- 无需额外工具（curl/wget）
- 支持 JS 触发的下载

---

### 2.2 数据抓取模板 (P1)

#### 功能描述

提供常见数据抓取的 Skill 模板。

#### 模板列表

| 模板 | 功能 |
|------|------|
| `scrape-table` | 抓取表格数据 → JSON/CSV |
| `scrape-list` | 抓取列表数据 → JSON |
| `scrape-pagination` | 分页抓取 |

#### 使用方式

```bash
hab extract-table --selector "table.data" --output data.json
hab extract-list --selector "ul.items li" --output items.json
```

---

### 2.3 网页监控 (P2)

#### 功能描述

定期检查网页变化，触发通知。

#### 使用场景

- 价格监控
- 库存监控
- 内容更新检测

#### Skill 定义

```markdown
## 监控任务

1. 定期执行 `hab open <url>`
2. 提取目标数据 `hab evaluate <script>`
3. 与上次结果对比
4. 如有变化 → 通知用户
```

---

## 三、优先级路线图

| 阶段 | 优先级 | 能力 | 实现方式 |
|------|--------|------|----------|
| Phase 1 | P0 | 智能登录检测 | Skill |
| Phase 1 | P0 | 文件下载 | hab CLI 新增命令 |
| Phase 2 | P1 | 智能等待策略 | Skill 指导 + 已有命令 |
| Phase 2 | P1 | 操作重试策略 | Skill 指导 |
| Phase 2 | P1 | 数据抓取模板 | 已有命令 + Skill 模板 |
| Phase 3 | P2 | 验证码处理 | Skill |
| Phase 3 | P2 | 网页监控 | Skill |
| Future | - | 多标签页支持 | hab CLI 增强 |

---

## 四、Skill 文件结构

```
skills/
├── hyper-agent-browser.md      # 基础使用指南（已有）
├── login-detection.md          # 智能登录检测
├── retry-strategy.md           # 重试策略
├── download-guide.md           # 下载指南
└── scraping-templates.md       # 抓取模板
```

---

## 五、实现计划

### Phase 1（优先实现）

1. **智能登录检测 Skill**
   - 编写 `skills/login-detection.md`
   - 定义 auto/confirm 两种模式
   - 包含完整执行流程和代码示例

2. **下载命令**
   - 新增 `hab download` 命令
   - 支持指定下载目录
   - 返回下载文件路径

### Phase 2

3. **智能等待 Skill**
4. **重试策略 Skill**
5. **数据抓取模板**

### Phase 3

6. **验证码处理 Skill**
7. **网页监控 Skill**

---

## 六、验收标准

### 智能登录检测

- [ ] Agent 访问需登录页面时自动识别
- [ ] 自动切换 headed 模式供用户登录
- [ ] 轮询检测登录完成
- [ ] 自动切回 headless 继续任务
- [ ] confirm 模式正常询问用户

### 文件下载

- [ ] `hab download @e1` 成功下载文件
- [ ] 下载携带登录态
- [ ] 返回正确的文件路径

---

## 附录：配置参考

### Skill Frontmatter 完整配置

```yaml
---
alwaysApply: false
evolving: true

loginDetection:
  mode: auto | confirm
  pollInterval: 60000
  maxWaitTime: 600000

retry:
  maxAttempts: 3
  backoff: exponential

wait:
  defaultStrategy: idle | fixed
  defaultTimeout: 30000
---
```
