# hyper-browser

Control web browsers through CLI commands for automation tasks.

## Overview

hyperagentbrowser (hba) is a browser automation CLI that lets you:
- Navigate web pages
- Interact with elements (click, fill, type)
- Extract page information via snapshots
- Maintain login sessions across invocations

## Core Workflow

1. **Open a page**: `hba open <url>`
2. **Get snapshot**: `hba snapshot -i` to see interactive elements
3. **Analyze snapshot**: Find target element references (@e1, @e2, etc.)
4. **Execute action**: `hba click @e5` or `hba fill @e3 "text"`
5. **Repeat** until task is complete

## Commands Quick Reference

### Navigation
- `hba open <url>` - Open URL
- `hba reload` - Refresh page
- `hba back` / `hba forward` - Navigate history

### Actions
- `hba click <selector>` - Click element
- `hba fill <selector> <value>` - Fill input (clears first)
- `hba type <selector> <text>` - Type text (no clear)
- `hba press <key>` - Press key (Enter, Tab, Escape, etc.)

### Information
- `hba snapshot -i` - Get interactive elements (MOST IMPORTANT)
- `hba url` - Get current URL
- `hba title` - Get page title

### Session
- `hba --session <name> <cmd>` - Use named session
- `hba sessions` - List sessions
- `hba close` - Close browser

## Selector Format

- `@e1`, `@e2`, ... - Element references from snapshot (preferred)
- `css=.class` - CSS selector
- `text=Click me` - Text content match
- `xpath=//button` - XPath

## Example: Login Flow

```bash
hba --headed -s mysite open https://example.com/login
hba snapshot -i
# Output shows: @e3 [textbox] "Email", @e4 [textbox] "Password", @e5 [button] "Sign in"
hba fill @e3 "user@example.com"
hba fill @e4 "password123"
hba click @e5
hba wait navigation
hba snapshot -i
# Verify login success
```
