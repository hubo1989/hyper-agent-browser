# HBA vs agent-browser 功能差异分析

## 已实现功能 ✅

### 导航
- open/goto/navigate
- back
- forward
- reload

### 基础操作
- click
- type
- fill
- press/key
- hover
- select
- scroll

### 信息获取
- snapshot (核心)
- screenshot
- eval/evaluate
- title
- url
- content (获取文本)

### Session管理
- close
- sessions

## 缺失功能分析

### 🔴 高优先级 (AI Agent 常用场景)

#### 1. 复选框/单选框操作
```bash
❌ agent-browser check <sel>      # 勾选
❌ agent-browser uncheck <sel>    # 取消勾选
```
**影响**: 表单填写场景必需

#### 2. 元素信息获取
```bash
❌ agent-browser get text <sel>       # 获取文本内容
❌ agent-browser get value <sel>      # 获取输入值
❌ agent-browser get attr <sel> <attr> # 获取属性
❌ agent-browser get count <sel>      # 计数匹配元素
```
**影响**: AI 需要提取页面数据做决策

#### 3. 元素状态检查
```bash
❌ agent-browser is visible <sel>   # 是否可见
❌ agent-browser is enabled <sel>   # 是否启用
❌ agent-browser is checked <sel>   # 是否勾选
```
**影响**: AI 决策前需要验证元素状态

#### 4. 文件上传
```bash
❌ agent-browser upload <sel> <files>
```
**影响**: 上传文档/图片是常见任务

#### 5. 双击
```bash
❌ agent-browser dblclick <sel>
```
**影响**: 某些UI组件需要双击

#### 6. 滚动到元素
```bash
❌ agent-browser scrollintoview <sel>
```
**影响**: 确保操作的元素在视口内

#### 7. PDF导出
```bash
❌ agent-browser pdf <path>
```
**影响**: 保存网页内容

#### 8. 增强等待条件
```bash
❌ agent-browser wait --text "Welcome"
❌ agent-browser wait --url "**/dashboard"
❌ agent-browser wait --fn "window.loaded === true"
```
**影响**: 更精确的等待条件

#### 9. 对话框处理
```bash
❌ agent-browser dialog accept [text]
❌ agent-browser dialog dismiss
```
**影响**: alert/confirm/prompt 弹窗处理

### 🟡 中优先级 (增强AI能力)

#### 10. 语义定位器 (find命令)
```bash
❌ agent-browser find role button click --name "Submit"
❌ agent-browser find text "Sign In" click
❌ agent-browser find label "Email" fill "test@test.com"
❌ agent-browser find placeholder "Enter email" fill "x@y.com"
❌ agent-browser find testid "login-btn" click
❌ agent-browser find first ".item" click
❌ agent-browser find nth 2 "a" text
```
**影响**: 比 CSS 选择器更符合人类思维，AI 更容易理解

#### 11. Cookie & Storage 管理
```bash
❌ agent-browser cookies                    # 获取所有 cookies
❌ agent-browser cookies set <name> <val>   # 设置 cookie
❌ agent-browser cookies clear              # 清除 cookies

❌ agent-browser storage local              # 获取 localStorage
❌ agent-browser storage local set <k> <v>  # 设置值
❌ agent-browser storage local clear        # 清除
❌ agent-browser storage session            # sessionStorage
```
**影响**: 直接操作存储，调试登录状态

#### 12. 设备模拟
```bash
❌ agent-browser set viewport <w> <h>    # 设置视口大小
❌ agent-browser set device "iPhone 14"  # 模拟设备
❌ agent-browser set media dark|light    # 深色/浅色模式
```
**影响**: 测试响应式设计

#### 13. 多标签页管理
```bash
❌ agent-browser tab                  # 列出所有标签
❌ agent-browser tab new [url]        # 新建标签
❌ agent-browser tab <n>              # 切换到标签n
❌ agent-browser tab close [n]        # 关闭标签
```
**影响**: 多页面并行操作

#### 14. Focus 控制
```bash
❌ agent-browser focus <sel>
```
**影响**: 某些表单需要先聚焦再输入

#### 15. 获取边界框
```bash
❌ agent-browser get box <sel>
```
**影响**: 精确定位元素位置

### 🟢 低优先级 (高级功能)

#### 16. 拖拽
```bash
❌ agent-browser drag <src> <tgt>
```
**影响**: 拖拽排序等高级交互

#### 17. 精细鼠标控制
```bash
❌ agent-browser mouse move <x> <y>
❌ agent-browser mouse down [button]
❌ agent-browser mouse up [button]
❌ agent-browser mouse wheel <dy> [dx]
```
**影响**: 精确鼠标操作

#### 18. 精细键盘控制
```bash
❌ agent-browser keydown <key>
❌ agent-browser keyup <key>
```
**影响**: 组合键等高级操作

#### 19. 网络拦截
```bash
❌ agent-browser network route <url>
❌ agent-browser network route <url> --abort
❌ agent-browser network route <url> --body <json>
❌ agent-browser network requests
```
**影响**: Mock API 响应，测试场景

#### 20. iframe 切换
```bash
❌ agent-browser frame <sel>
❌ agent-browser frame main
```
**影响**: 操作嵌入式内容

#### 21. 调试工具
```bash
❌ agent-browser trace start/stop
❌ agent-browser console
❌ agent-browser errors
❌ agent-browser highlight <sel>
```
**影响**: 开发调试

#### 22. 状态保存/加载
```bash
❌ agent-browser state save <path>
❌ agent-browser state load <path>
```
**影响**: 快速恢复登录状态（注：hab 通过 session 机制已实现类似功能）

#### 23. 地理位置等高级设置
```bash
❌ agent-browser set geo <lat> <lng>
❌ agent-browser set offline on|off
❌ agent-browser set headers <json>
❌ agent-browser set credentials <user> <pass>
```
**影响**: 模拟特定环境

#### 24. HTML 获取
```bash
❌ agent-browser get html <sel>
```
**影响**: 获取元素 HTML 结构

## 优先级建议

### 第一批实现（立即）
1. **check/uncheck** - 表单必需
2. **get text/value/attr** - 数据提取必需
3. **is visible/enabled/checked** - 状态验证必需
4. **dblclick** - 常见操作
5. **upload** - 文件上传场景
6. **scrollintoview** - 确保元素可见

### 第二批实现（近期）
7. **wait --text/--url/--fn** - 增强等待能力
8. **dialog accept/dismiss** - 弹窗处理
9. **find role/text/label** - 语义定位器
10. **pdf** - 页面导出
11. **cookies/storage** - 存储管理
12. **focus** - 表单聚焦
13. **get count/box** - 元素信息

### 第三批实现（规划）
14. **tab** - 多标签页
15. **set viewport/device** - 设备模拟
16. **drag** - 拖拽操作
17. **mouse/keyboard 精细控制** - 高级交互
18. **network route** - 网络拦截
19. **frame** - iframe 操作
20. **调试工具** - 开发辅助

## 实现策略

### 命令设计原则
1. 保持与 agent-browser 一致的命令名称（降低学习成本）
2. 使用相同的参数约定（如 `<sel>` 表示选择器）
3. 支持 4 种选择器格式：`@e1`, `css=`, `text=`, `xpath=`
4. 通过 daemon 统一执行，保持架构一致

### 实现顺序
1. 先实现 `src/commands/` 下的命令函数
2. 在 `src/daemon/server.ts` 中注册命令
3. 在 `src/cli.ts` 中添加 CLI 定义
4. 更新 `hab.skill.md` 文档
5. 添加测试用例

## 当前 HBA 的差异化优势

虽然缺失部分功能，但 HBA 有以下优势：

1. **Daemon 架构** - 浏览器复用，性能优异
2. **Session 隔离** - 多账号自动隔离
3. **Patchright** - 更好的反检测能力
4. **Bun 运行时** - 更快的启动速度
5. **Snapshot 系统** - @e 引用更适合 AI

## 下一步行动

建议立即实现第一批 6 个高优先级功能，预计增加约 300 行代码，完成后可覆盖 80% 的 AI Agent 使用场景。
