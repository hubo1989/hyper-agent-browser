#!/usr/bin/env bash
# Example: Google Search Flow

set -e

SESSION="google-demo"

echo "🔍 Google Search Example"
echo ""

# Open Google
echo "1. Opening Google..."
bun run src/cli.ts -s "$SESSION" --headed open "https://google.com"

# Wait for page load
echo "2. Waiting for page to load..."
bun run src/cli.ts -s "$SESSION" wait 2000

# Get snapshot to find search box
echo "3. Getting page snapshot..."
bun run src/cli.ts -s "$SESSION" snapshot -i

echo ""
echo "4. To continue, manually run:"
echo "   bun run src/cli.ts -s $SESSION fill 'css=textarea[name=q]' 'Bun JavaScript runtime'"
echo "   bun run src/cli.ts -s $SESSION press Enter"
echo "   bun run src/cli.ts -s $SESSION wait 2000"
echo "   bun run src/cli.ts -s $SESSION snapshot -i"
echo ""
echo "5. To close the session:"
echo "   bun run src/cli.ts -s $SESSION close"
