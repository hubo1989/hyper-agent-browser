#!/usr/bin/env bash
set -e

echo "🚀 Initializing hyperagentbrowser project..."

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p src/{browser,session,commands,snapshot,utils}
mkdir -p tests/{unit,integration,e2e}
mkdir -p skills
mkdir -p examples
mkdir -p dist

# Create package.json
echo "📦 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "hyper-browser-agent",
  "version": "0.1.0",
  "description": "Pure browser automation CLI for AI Agents",
  "type": "module",
  "bin": {
    "hab": "src/cli.ts"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build --compile --minify src/cli.ts --outfile dist/hab",
    "build:all": "bun run scripts/build-all.ts",
    "test": "bun test",
    "test:unit": "bun test tests/unit",
    "test:integration": "bun test tests/integration",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "lint": "bunx @biomejs/biome check .",
    "lint:fix": "bunx @biomejs/biome check --write .",
    "typecheck": "bunx tsc --noEmit"
  },
  "keywords": [
    "browser-automation",
    "cli",
    "ai-agent",
    "playwright",
    "patchright"
  ],
  "author": "Hubert",
  "license": "MIT",
  "dependencies": {
    "patchright": "^1.55.1",
    "commander": "^12.0.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@biomejs/biome": "^1.9.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "bun": ">=1.1.0"
  }
}
EOF

# Create tsconfig.json
echo "⚙️  Creating tsconfig.json..."
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "types": ["bun"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# Create biome.json
echo "🎨 Creating biome.json..."
cat > biome.json << 'EOF'
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "useConst": "error",
        "useTemplate": "warn"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  }
}
EOF

# Create .gitignore
echo "🙈 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
bun.lockb

# Build output
dist/
*.log

# Test coverage
coverage/

# OS files
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo

# Runtime data
~/.hab/

# Local config
.env
.env.local
EOF

# Create README.md
echo "📖 Creating README.md..."
cat > README.md << 'EOF'
# hyperagentbrowser (hab)

Pure browser automation CLI for AI Agents.

## Quick Start

```bash
# Install dependencies
bun install

# Run in dev mode
bun dev -- --help

# Build single executable
bun run build

# Run tests
bun test
```

## Usage

```bash
# Open a URL
hab open https://google.com

# Get interactive elements snapshot
hab snapshot -i

# Click an element
hab click @e1

# Fill input
hab fill @e2 "search query"

# Press key
hab press Enter
```

See [hyper-agent-browser-spec.md](./hyper-agent-browser-spec.md) for full documentation.

## Architecture

- **Runtime**: Bun >= 1.1.0
- **Browser Driver**: Patchright (anti-detection Playwright fork)
- **CLI Framework**: Commander.js

## License

MIT
EOF

# Create placeholder files
echo "📝 Creating source file placeholders..."

# CLI entry
cat > src/cli.ts << 'EOF'
#!/usr/bin/env bun
import { Command } from 'commander';

const program = new Command();

program
  .name('hab')
  .description('hyperagentbrowser - Browser automation CLI for AI Agents')
  .version('0.1.0');

// Global options
program
  .option('-s, --session <name>', 'Session name', 'default')
  .option('-H, --headed', 'Show browser window', false)
  .option('-c, --channel <browser>', 'Browser channel (chrome/msedge/chromium)', 'chrome')
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', '30000')
  .option('-v, --verbose', 'Verbose output', false);

// TODO: Add commands
program
  .command('open <url>')
  .description('Open a URL')
  .action((url) => {
    console.log(`TODO: Open ${url}`);
  });

program
  .command('snapshot')
  .description('Get page snapshot')
  .option('-i, --interactive', 'Show only interactive elements')
  .action((options) => {
    console.log('TODO: Get snapshot', options);
  });

program.parse();
EOF

# Utils placeholders
cat > src/utils/config.ts << 'EOF'
import { z } from 'zod';

export const ConfigSchema = z.object({
  version: z.string(),
  defaults: z.object({
    session: z.string(),
    headed: z.boolean(),
    channel: z.enum(['chrome', 'msedge', 'chromium']),
    timeout: z.number(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  // TODO: Load from ~/.hab/config.json
  return {
    version: '1.0',
    defaults: {
      session: 'default',
      headed: false,
      channel: 'chrome',
      timeout: 30000,
    },
  };
}
EOF

cat > src/utils/logger.ts << 'EOF'
export function log(message: string, verbose = false) {
  if (verbose) {
    console.log(`[HBA] ${message}`);
  }
}

export function error(message: string, hint?: string) {
  console.error(`Error: ${message}`);
  if (hint) {
    console.error(`  Hint: ${hint}`);
  }
}
EOF

cat > src/utils/selector.ts << 'EOF'
export type SelectorType = 'ref' | 'css' | 'text' | 'xpath';

export interface ParsedSelector {
  type: SelectorType;
  value: string;
}

export function parseSelector(selector: string): ParsedSelector {
  if (selector.startsWith('@e')) {
    return { type: 'ref', value: selector.slice(1) };
  }
  if (selector.startsWith('css=')) {
    return { type: 'css', value: selector.slice(4) };
  }
  if (selector.startsWith('text=')) {
    return { type: 'text', value: selector.slice(5) };
  }
  if (selector.startsWith('xpath=')) {
    return { type: 'xpath', value: selector.slice(6) };
  }
  // Default to CSS
  return { type: 'css', value: selector };
}
EOF

# Test placeholder
cat > tests/unit/selector.test.ts << 'EOF'
import { describe, it, expect } from 'bun:test';
import { parseSelector } from '../../src/utils/selector';

describe('parseSelector', () => {
  it('should parse element reference', () => {
    const result = parseSelector('@e5');
    expect(result).toEqual({ type: 'ref', value: 'e5' });
  });

  it('should parse CSS selector', () => {
    const result = parseSelector('css=.btn');
    expect(result).toEqual({ type: 'css', value: '.btn' });
  });

  it('should parse text selector', () => {
    const result = parseSelector('text=Login');
    expect(result).toEqual({ type: 'text', value: 'Login' });
  });

  it('should parse xpath selector', () => {
    const result = parseSelector('xpath=//button');
    expect(result).toEqual({ type: 'xpath', value: '//button' });
  });

  it('should default to CSS for plain selectors', () => {
    const result = parseSelector('.btn');
    expect(result).toEqual({ type: 'css', value: '.btn' });
  });
});
EOF

# Skill file
cat > skills/hyper-browser.md << 'EOF'
# hyper-browser

Control web browsers through CLI commands for automation tasks.

## Overview

hyperagentbrowser (hab) is a browser automation CLI that lets you:
- Navigate web pages
- Interact with elements (click, fill, type)
- Extract page information via snapshots
- Maintain login sessions across invocations

## Core Workflow

1. **Open a page**: `hab open <url>`
2. **Get snapshot**: `hab snapshot -i` to see interactive elements
3. **Analyze snapshot**: Find target element references (@e1, @e2, etc.)
4. **Execute action**: `hab click @e5` or `hab fill @e3 "text"`
5. **Repeat** until task is complete

## Commands Quick Reference

### Navigation
- `hab open <url>` - Open URL
- `hab reload` - Refresh page
- `hab back` / `hab forward` - Navigate history

### Actions
- `hab click <selector>` - Click element
- `hab fill <selector> <value>` - Fill input (clears first)
- `hab type <selector> <text>` - Type text (no clear)
- `hab press <key>` - Press key (Enter, Tab, Escape, etc.)

### Information
- `hab snapshot -i` - Get interactive elements (MOST IMPORTANT)
- `hab url` - Get current URL
- `hab title` - Get page title

### Session
- `hab --session <name> <cmd>` - Use named session
- `hab sessions` - List sessions
- `hab close` - Close browser

## Selector Format

- `@e1`, `@e2`, ... - Element references from snapshot (preferred)
- `css=.class` - CSS selector
- `text=Click me` - Text content match
- `xpath=//button` - XPath

## Example: Login Flow

```bash
hab --headed -s mysite open https://example.com/login
hab snapshot -i
# Output shows: @e3 [textbox] "Email", @e4 [textbox] "Password", @e5 [button] "Sign in"
hab fill @e3 "user@example.com"
hab fill @e4 "password123"
hab click @e5
hab wait navigation
hab snapshot -i
# Verify login success
```
EOF

echo ""
echo "✅ Project structure created!"
echo ""
echo "Next steps:"
echo "  1. bun install          # Install dependencies"
echo "  2. bun dev -- --help    # Test CLI"
echo "  3. bun test             # Run tests"
echo ""
