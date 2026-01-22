# release

Automate the release process for hyper-agent-browser.

---
alwaysApply: false
---

## Trigger

Use this skill when user says:
- `/release`
- `/release patch` (default: bump patch version)
- `/release minor`
- `/release major`
- `release new version`
- `publish new version`

## Release Workflow

Execute these steps in order. If any step fails, fix the issue and retry from that step.

### Step 1: Determine Version Bump

Check the argument:
- `patch` (default): 0.3.2 → 0.3.3
- `minor`: 0.3.2 → 0.4.0
- `major`: 0.3.2 → 1.0.0

Read current version from `package.json` and calculate new version.

### Step 2: Update Version

```bash
# Update package.json version
npm version <patch|minor|major> --no-git-tag-version
```

### Step 3: Run All Checks

Run these checks in sequence. If any fails, fix the issues and re-run:

```bash
# TypeScript type check
bun run typecheck

# Lint check
bun run lint

# Unit tests
bun test tests/unit

# Integration tests (optional, may skip if too slow)
bun test tests/integration
```

**If lint fails**: Run `bunx @biomejs/biome check --write .` to auto-fix, then manually fix remaining issues.

**If tests fail**: Analyze the failure, fix the code, and re-run tests.

### Step 4: Commit and Push

```bash
# Stage all changes
git add -A

# Commit with conventional commit message
git commit -m "chore(release): v<VERSION>

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to main
git push origin main

# Create and push tag
git tag v<VERSION>
git push origin v<VERSION>
```

### Step 5: Create GitHub Release

```bash
gh release create v<VERSION> --title "v<VERSION>" --notes "$(cat <<'EOF'
## What's Changed

<Summarize changes since last release based on git log>

## Installation

\`\`\`bash
npm install -g hyper-agent-browser@<VERSION>
\`\`\`

**Full Changelog**: https://github.com/hubo1989/hyper-agent-browser/compare/v<PREV_VERSION>...v<VERSION>
EOF
)"
```

### Step 6: Verify Release

```bash
# Check release was created
gh release view v<VERSION>
```

## Output

Report the final status:
- ✅ Version bumped to v<VERSION>
- ✅ All checks passed (typecheck, lint, tests)
- ✅ Committed and pushed to GitHub
- ✅ Release created: <release_url>

Or if failed:
- ❌ Failed at step X: <error message>
- 💡 Suggested fix: <suggestion>
