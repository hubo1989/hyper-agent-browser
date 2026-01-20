#!/bin/bash
# 将所有 hab 引用改为 hab

set -e

echo "开始将 hab 重命名为 hab..."

# 文件类型
FILE_PATTERNS=(-name "*.ts" -o -name "*.md" -o -name "*.sh" -o -name "*.json")
EXCLUDE_DIRS=(-path "*/node_modules/*" -o -path "*/.git/*" -o -path "*/dist/*")

# 1. 替换 .hab -> .hab (配置目录)
echo "1. 替换配置目录名 .hab -> .hab"
find . -type f \( "${FILE_PATTERNS[@]}" \) ! \( "${EXCLUDE_DIRS[@]}" \) -exec sed -i '' 's/\.hab/.hab/g' {} +

# 2. 替换 HAB_ -> HAB_ (环境变量)
echo "2. 替换环境变量前缀 HAB_ -> HAB_"
find . -type f \( "${FILE_PATTERNS[@]}" \) ! \( "${EXCLUDE_DIRS[@]}" \) -exec sed -i '' 's/HAB_/HAB_/g' {} +

# 3. 替换 hab 命令 (需要更精确的匹配)
echo "3. 替换命令名 hab -> hab"
# 匹配 "hab ", 'hab ', \`hab \`, hab\n, /hab, dist/hab
find . -type f \( "${FILE_PATTERNS[@]}" \) ! \( "${EXCLUDE_DIRS[@]}" \) -exec sed -i '' -E 's/(^|[^a-z])hab([^a-z]|$)/\1hab\2/g' {} +

# 4. 特殊处理：hab.skill.md 文件名
if [ -f "hab.skill.md" ]; then
  echo "4. 重命名 hab.skill.md -> hab.skill.md"
  git mv hab.skill.md hab.skill.md || mv hab.skill.md hab.skill.md
fi

echo "✅ 重命名完成！"
echo ""
echo "请检查以下文件的改动："
echo "  - package.json (bin 命令)"
echo "  - src/utils/config.ts (配置路径)"
echo "  - README.md (所有示例)"
echo "  - CLAUDE.md (文档说明)"
echo ""
echo "确认无误后运行："
echo "  git add -A"
echo "  git commit -m '♻️ refactor: 统一命令名为 hab (hyper-agent-browser -> hab)'"
