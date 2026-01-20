# hyper-browser

Control web browsers through CLI commands for automation tasks.

## Overview

hyper-agent-browser (hab) is a browser automation CLI that lets you:
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
