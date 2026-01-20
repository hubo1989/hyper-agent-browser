#!/usr/bin/env bash
# 完整的 @eN 引用工作流示例

set -e

SESSION="element-ref-demo"

echo "🎯 @eN 元素引用完整示例"
echo ""

# 1. 打开网页
echo "1. 打开示例网页..."
bun dev -- -s "$SESSION" --headed open "https://example.com"

# 2. 等待页面加载
echo "2. 等待页面加载..."
bun dev -- -s "$SESSION" wait 2000

# 3. 获取快照（生成 @eN 引用）
echo "3. 获取页面快照（生成元素引用）..."
bun dev -- -s "$SESSION" snapshot -i

echo ""
echo "✨ 现在你可以使用 @e1, @e2 等引用来操作元素"
echo ""
echo "示例操作："
echo "  # 点击第一个链接"
echo "  bun dev -- -s $SESSION click @e1"
echo ""
echo "  # 获取页面标题"
echo "  bun dev -- -s $SESSION title"
echo ""
echo "  # 截图"
echo "  bun dev -- -s $SESSION screenshot -o example.png"
echo ""
echo "  # 关闭会话"
echo "  bun dev -- -s $SESSION close"
echo ""
