#!/usr/bin/env bash
# 导入 Chrome Profile 到 hab Session

set -e

# 使用方式
show_usage() {
  cat << EOF
用法: $0 [选项]

导入 Chrome Profile 到 hab Session，保留 Google 登录状态

选项:
  -s, --session NAME       Session 名称（默认: google-profile）
  -p, --profile PATH       Chrome Profile 路径（默认: 自动检测 Default）
  --full                   复制完整 Profile（默认: 只复制关键文件）
  -h, --help               显示帮助

示例:
  # 导入默认 Chrome Profile
  $0 -s gmail

  # 导入指定 Profile
  $0 -s work --profile ~/Library/Application\ Support/Google/Chrome/Profile\ 1

  # 完整复制
  $0 -s gmail --full
EOF
}

# 默认值
SESSION_NAME="google-profile"
CHROME_PROFILE=""
FULL_COPY=false

# 解析参数
while [[ $# -gt 0 ]]; do
  case $1 in
    -s|--session)
      SESSION_NAME="$2"
      shift 2
      ;;
    -p|--profile)
      CHROME_PROFILE="$2"
      shift 2
      ;;
    --full)
      FULL_COPY=true
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      echo "未知选项: $1"
      show_usage
      exit 1
      ;;
  esac
done

# 自动检测 Chrome Profile 路径
if [ -z "$CHROME_PROFILE" ]; then
  if [ -d "$HOME/Library/Application Support/Google/Chrome/Default" ]; then
    CHROME_PROFILE="$HOME/Library/Application Support/Google/Chrome/Default"
    echo "✓ 检测到 macOS Chrome Profile"
  elif [ -d "$HOME/.config/google-chrome/Default" ]; then
    CHROME_PROFILE="$HOME/.config/google-chrome/Default"
    echo "✓ 检测到 Linux Chrome Profile"
  else
    echo "❌ 无法自动检测 Chrome Profile"
    echo "请使用 -p 参数指定 Profile 路径"
    exit 1
  fi
fi

# 验证源路径
if [ ! -d "$CHROME_PROFILE" ]; then
  echo "❌ Chrome Profile 不存在: $CHROME_PROFILE"
  exit 1
fi

# 目标路径
HAB_SESSION_DIR="$HOME/.hab/sessions/$SESSION_NAME"
TARGET_DIR="$HAB_SESSION_DIR/userdata/Default"

echo ""
echo "配置:"
echo "  源 Profile: $CHROME_PROFILE"
echo "  目标 Session: $SESSION_NAME"
echo "  目标路径: $TARGET_DIR"
echo "  复制模式: $([ "$FULL_COPY" = true ] && echo "完整" || echo "关键文件")"
echo ""

# 创建目录
mkdir -p "$TARGET_DIR"
mkdir -p "$HAB_SESSION_DIR"

# 复制文件
if [ "$FULL_COPY" = true ]; then
  echo "📦 复制完整 Profile（可能需要较长时间）..."
  cp -r "$CHROME_PROFILE"/* "$TARGET_DIR/"
  echo "✓ 完整 Profile 已复制"
else
  echo "📦 复制关键文件（Cookies, Storage）..."

  # 复制关键文件/目录
  for item in "Cookies" "Cookies-journal" "Local Storage" "Session Storage" "IndexedDB" "Web Data"; do
    if [ -e "$CHROME_PROFILE/$item" ]; then
      cp -r "$CHROME_PROFILE/$item" "$TARGET_DIR/" 2>/dev/null || true
      echo "  ✓ $item"
    fi
  done

  echo "✓ 关键文件已复制"
fi

# 创建 session.json
cat > "$HAB_SESSION_DIR/session.json" << EOF
{
  "name": "$SESSION_NAME",
  "status": "stopped",
  "channel": "chrome",
  "userDataDir": "$TARGET_DIR",
  "createdAt": $(date +%s)000,
  "lastActiveAt": $(date +%s)000
}
EOF

echo ""
echo "🎉 Profile 导入成功！"
echo ""
echo "测试 Session:"
echo "  bun dev -- -s $SESSION_NAME --headed open https://mail.google.com"
echo ""
echo "列出所有 Sessions:"
echo "  bun dev -- sessions"
echo ""
