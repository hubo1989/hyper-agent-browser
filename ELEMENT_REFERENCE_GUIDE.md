# @eN 元素引用功能完整文档

## 概述

hyperagentbrowser 现在支持使用 `@e1`, `@e2` 等引用来操作页面元素，无需手动编写 CSS 选择器。

## 工作原理

1. **获取快照**: `hab snapshot -i` 扫描页面，为每个可交互元素生成 `@eN` 引用
2. **映射存储**: 引用和实际 CSS 选择器的映射保存在 `~/.hab/sessions/<session>/element-mappings.json`
3. **使用引用**: 在后续命令中使用 `@e1` 等引用来操作元素

## 完整工作流示例

### 示例 1: Google 搜索

```bash
# 1. 打开 Google
bun dev -- -s google --headed open https://google.com

# 2. 等待加载
bun dev -- -s google wait 2000

# 3. 获取快照查看可交互元素
bun dev -- -s google snapshot -i

# 输出示例:
# URL: https://google.com
# Title: Google
#
# Interactive Elements:
# @e1  [textbox]   "Search"
# @e2  [button]    "Google Search"
# @e3  [button]    "I'm Feeling Lucky"
# @e4  [link]      "Gmail"
# @e5  [link]      "Images"

# 4. 在搜索框输入文本（使用 @e1 引用）
bun dev -- -s google fill @e1 "Bun JavaScript runtime"

# 5. 按 Enter 搜索
bun dev -- -s google press Enter

# 6. 等待结果加载
bun dev -- -s google wait 3000

# 7. 再次获取快照查看结果页面
bun dev -- -s google snapshot -i

# 8. 截图保存
bun dev -- -s google screenshot -o google-results.png

# 9. 关闭
bun dev -- -s google close
```

### 示例 2: GitHub 登录（使用 CSS 选择器）

```bash
# 如果 @eN 引用不可用，仍可使用传统选择器

# 打开 GitHub 登录页
bun dev -- -s github --headed open https://github.com/login

# 使用 CSS 选择器填写表单
bun dev -- -s github fill 'css=#login_field' "username"
bun dev -- -s github fill 'css=#password' "password"

# 使用文本选择器点击按钮
bun dev -- -s github click 'text=Sign in'

# 关闭
bun dev -- -s github close
```

### 示例 3: 混合使用

```bash
# 打开页面
bun dev -- -s test --headed open https://example.com

# 获取快照
bun dev -- -s test snapshot -i

# 使用 @eN 引用点击
bun dev -- -s test click @e1

# 使用 CSS 选择器操作
bun dev -- -s test fill 'css=#email' "test@example.com"

# 使用文本选择器
bun dev -- -s test click 'text=Submit'

# 关闭
bun dev -- -s test close
```

## 支持的选择器格式

| 格式 | 示例 | 说明 |
|------|------|------|
| `@eN` | `@e1`, `@e5` | 元素引用（需先运行 snapshot） |
| `css=` | `css=#login` | CSS 选择器 |
| `text=` | `text=Sign in` | 文本内容匹配 |
| `xpath=` | `xpath=//button` | XPath 选择器 |

## 映射文件

元素引用映射存储在每个 session 的目录中：

```
~/.hab/sessions/<session-name>/
├── userdata/                  # Chrome UserData
├── session.json               # Session 元数据
└── element-mappings.json      # @eN 引用映射
```

**element-mappings.json 示例**:
```json
{
  "e1": "textarea[name=q]",
  "e2": "button > input[value=\"Google Search\"]",
  "e3": "button > input[value=\"I'm Feeling Lucky\"]",
  "e4": "a[href=\"https://mail.google.com\"]",
  "e5": "a[href=\"https://images.google.com\"]"
}
```

## 最佳实践

### 1. 定期更新快照

页面内容变化后，需要重新获取快照：

```bash
# 导航到新页面后
bun dev -- -s mysession click @e5
bun dev -- -s mysession wait 2000

# 重新获取快照更新引用
bun dev -- -s mysession snapshot -i
```

### 2. 优先使用 @eN 引用

**优点**:
- 简洁易读
- 与 AI Agent 配合更好
- 自动生成，无需手动编写选择器

**缺点**:
- 需要先运行 snapshot
- 页面变化后需要更新

### 3. 错误处理

```bash
# 如果引用不存在
$ bun dev -- -s test click @e99
Error: Element reference @e99 not found. Run 'hab snapshot -i' to update element references.

# 如果未运行过 snapshot
$ bun dev -- -s test click @e1
Error: Element reference @e1 requires a snapshot first. Run 'hab snapshot -i' to generate element references.
```

## AI Agent 集成

在 skills/hyper-browser.md 中使用：

```markdown
## 使用流程

1. 打开页面: `hab open <url>`
2. 获取快照: `hab snapshot -i`
3. 分析快照找到目标元素的引用（如 @e5）
4. 执行操作: `hab click @e5`
5. 重复步骤 2-4 直到任务完成
```

## 高级用法

### 保存快照到文件

```bash
# JSON 格式
bun dev -- -s test snapshot -r -o snapshot.json

# 文本格式
bun dev -- -s test snapshot -i -o snapshot.txt
```

### 只看特定数量的元素

```bash
# 只显示前 10 个元素
bun dev -- -s test snapshot -i --max-elements 10
```

### 包含禁用元素

```bash
# 显示包括禁用元素在内的所有元素
bun dev -- -s test snapshot -f
```

## 故障排除

### 问题: 快照为空

**原因**: 页面可能还在加载，或没有可交互元素

**解决**:
```bash
# 等待更长时间
bun dev -- -s test wait 5000

# 然后重试
bun dev -- -s test snapshot -i
```

### 问题: 引用过期

**原因**: 页面内容已变化

**解决**:
```bash
# 重新获取快照
bun dev -- -s test snapshot -i
```

### 问题: 找不到元素

**原因**: 元素可能在 iframe 中，或需要滚动到视图中

**解决**:
```bash
# 先滚动
bun dev -- -s test scroll down --amount 500

# 然后重新获取快照
bun dev -- -s test snapshot -i
```

## 实现细节

### DOM 提取器

使用 DOM 遍历而非 Accessibility API（fallback 方案）：

- 遍历 DOM 树
- 识别可交互元素（button, link, input, etc.）
- 生成唯一的 CSS 选择器
- 创建 @eN 到选择器的映射

### 引用持久化

- 每个 session 独立的映射文件
- 自动保存和加载
- JSON 格式，易于调试

### 性能优化

- 只扫描可交互元素（默认）
- 可配置最大元素数量
- 缓存映射，避免重复计算
