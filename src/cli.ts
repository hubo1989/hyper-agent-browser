#!/usr/bin/env bun
import { Command } from "commander";
import * as configCommands from "./commands/config";
import { DaemonClient } from "./daemon/client";
import type { CommandRequest } from "./daemon/server";
import { getExitCode } from "./utils/errors";

const program = new Command();
const daemonClient = new DaemonClient();

program
  .name("hab")
  .description("hyper-agent-browser - Browser automation CLI for AI Agents")
  .version("0.2.0");

// Global options
program
  .option("-s, --session <name>", "Session name", "default")
  .option("-H, --headed", "Show browser window", false)
  .option("-c, --channel <browser>", "Browser channel (chrome/msedge/chromium)", "chrome")
  .option("-t, --timeout <ms>", "Timeout in milliseconds", "30000")
  .option("-v, --verbose", "Verbose output", false);

// Helper to execute command via daemon
async function executeViaDaemon(command: string, args: Record<string, any>, parentCommand: any) {
  const request: CommandRequest = {
    command,
    session: getSessionName(parentCommand),
    args,
    options: {
      headed: parentCommand.opts().headed || false,
      timeout: getTimeout(parentCommand),
      channel: getChannel(parentCommand),
    },
  };

  try {
    const response = await daemonClient.execute(request);

    if (!response.success) {
      console.error("Error:", response.error);
      process.exit(1);
    }

    return response.data;
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Navigation commands
program
  .command("open <url>")
  .description("Open a URL")
  .option("--wait-until <state>", "Wait until state (load/domcontentloaded/networkidle)", "load")
  .action(async (url, options, command) => {
    const result = await executeViaDaemon(
      "open",
      { url, waitUntil: options.waitUntil },
      command.parent,
    );
    console.log(result);
  });

program
  .command("reload")
  .description("Reload current page")
  .action(async (_options, command) => {
    const result = await executeViaDaemon("reload", {}, command.parent);
    console.log(result);
  });

program
  .command("back")
  .description("Go back in history")
  .action(async (_options, command) => {
    const result = await executeViaDaemon("back", {}, command.parent);
    console.log(result);
  });

program
  .command("forward")
  .description("Go forward in history")
  .action(async (_options, command) => {
    const result = await executeViaDaemon("forward", {}, command.parent);
    console.log(result);
  });

// Action commands
program
  .command("click <selector>")
  .description("Click an element")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("click", { selector }, command.parent);
    console.log(result);
  });

program
  .command("fill <selector> <value>")
  .description("Fill an input field")
  .action(async (selector, value, _options, command) => {
    const result = await executeViaDaemon("fill", { selector, value }, command.parent);
    console.log(result);
  });

program
  .command("type <selector> <text>")
  .description("Type text into an element")
  .option("--delay <ms>", "Delay between keystrokes", "0")
  .action(async (selector, text, options, command) => {
    const result = await executeViaDaemon(
      "type",
      { selector, text, delay: Number.parseInt(options.delay) },
      command.parent,
    );
    console.log(result);
  });

program
  .command("press <key>")
  .description("Press a key")
  .action(async (key, _options, command) => {
    const result = await executeViaDaemon("press", { key }, command.parent);
    console.log(result);
  });

program
  .command("scroll <direction>")
  .description("Scroll page (up/down/left/right)")
  .option("--amount <pixels>", "Scroll amount in pixels", "500")
  .option("--selector <selector>", "Scroll within element")
  .action(async (direction, options, command) => {
    const result = await executeViaDaemon(
      "scroll",
      {
        direction,
        amount: Number.parseInt(options.amount),
        selector: options.selector,
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("hover <selector>")
  .description("Hover over an element")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("hover", { selector }, command.parent);
    console.log(result);
  });

program
  .command("select <selector> <value>")
  .description("Select option from dropdown")
  .action(async (selector, value, _options, command) => {
    const result = await executeViaDaemon("select", { selector, value }, command.parent);
    console.log(result);
  });

program
  .command("wait [condition]")
  .description("Wait for condition (ms/selector=/hidden=/navigation)")
  .option("--timeout <ms>", "Timeout in milliseconds")
  .option("--text <text>", "Wait for text to appear")
  .option("--url <pattern>", "Wait for URL pattern")
  .option("--fn <function>", "Wait for JavaScript condition")
  .option("--load <state>", "Wait for load state (load/domcontentloaded/networkidle)")
  .action(async (condition, options, command) => {
    const result = await executeViaDaemon(
      "wait",
      {
        condition: condition || "",
        timeout: options.timeout,
        text: options.text,
        url: options.url,
        fn: options.fn,
        load: options.load,
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("wait-idle")
  .description("Wait for page to be idle (network + DOM stable)")
  .option("--timeout <ms>", "Timeout in milliseconds", "30000")
  .option("--strategy <strategy>", "Strategy: network, dom, or both", "both")
  .option("--network-idle-time <ms>", "Network idle time", "500")
  .option("--dom-stable-time <ms>", "DOM stable time", "500")
  .option("--ignore <selectors>", "Ignore DOM changes in selectors (comma-separated)")
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "wait-idle",
      {
        timeout: Number.parseInt(options.timeout),
        strategy: options.strategy,
        networkIdleTime: Number.parseInt(options.networkIdleTime),
        domStableTime: Number.parseInt(options.domStableTime),
        ignoreSelectors: options.ignore ? options.ignore.split(",") : undefined,
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("wait-element <selector>")
  .description("Wait for element state (attached/detached/visible/hidden)")
  .option("--state <state>", "Element state", "visible")
  .option("--timeout <ms>", "Timeout in milliseconds", "10000")
  .action(async (selector, options, command) => {
    const result = await executeViaDaemon(
      "wait-element",
      {
        selector,
        state: options.state,
        timeout: Number.parseInt(options.timeout),
      },
      command.parent,
    );
    console.log(result);
  });

// 第一批新增 Action 命令
program
  .command("check <selector>")
  .description("Check checkbox")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("check", { selector }, command.parent);
    console.log(result);
  });

program
  .command("uncheck <selector>")
  .description("Uncheck checkbox")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("uncheck", { selector }, command.parent);
    console.log(result);
  });

program
  .command("dblclick <selector>")
  .description("Double-click element")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("dblclick", { selector }, command.parent);
    console.log(result);
  });

program
  .command("focus <selector>")
  .description("Focus element")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("focus", { selector }, command.parent);
    console.log(result);
  });

program
  .command("upload <selector> <files...>")
  .description("Upload files")
  .action(async (selector, files, _options, command) => {
    const result = await executeViaDaemon("upload", { selector, files }, command.parent);
    console.log(result);
  });

program
  .command("scrollintoview <selector>")
  .description("Scroll element into view")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("scrollintoview", { selector }, command.parent);
    console.log(result);
  });

program
  .command("drag <source> <target>")
  .description("Drag and drop")
  .action(async (source, target, _options, command) => {
    const result = await executeViaDaemon("drag", { source, target }, command.parent);
    console.log(result);
  });

// Get 系列命令
program
  .command("get <subcommand> <selector> [attribute]")
  .description("Get element info (text/value/attr/html/count/box)")
  .action(async (subcommand, selector, attribute, _options, command) => {
    const result = await executeViaDaemon(
      "get",
      { subcommand, selector, attribute },
      command.parent,
    );
    console.log(result);
  });

// Is 系列命令
program
  .command("is <subcommand> <selector>")
  .description("Check element state (visible/enabled/checked/editable/hidden)")
  .action(async (subcommand, selector, _options, command) => {
    const result = await executeViaDaemon("is", { subcommand, selector }, command.parent);
    console.log(result);
  });

// 第二批新增高级命令

// Dialog 命令
program
  .command("dialog <action> [text]")
  .description("Handle dialogs (accept/dismiss)")
  .action(async (action, text, _options, command) => {
    const result = await executeViaDaemon("dialog", { action, text }, command.parent);
    console.log(result);
  });

// Cookie 命令
program
  .command("cookies [action] [name] [value]")
  .description("Manage cookies (get/set/clear)")
  .action(async (action, name, value, _options, command) => {
    const result = await executeViaDaemon("cookies", { action, name, value }, command.parent);
    if (typeof result === "object") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }
  });

// Storage 命令
program
  .command("storage <type> [action] [key] [value]")
  .description("Manage storage (local/session)")
  .action(async (type, action, key, value, _options, command) => {
    const result = await executeViaDaemon(
      "storage",
      {
        storageType: type,
        action,
        key,
        value,
      },
      command.parent,
    );
    if (typeof result === "object") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result);
    }
  });

// PDF 导出
program
  .command("pdf <path>")
  .description("Save page as PDF")
  .option("--format <format>", "Paper format (A4/Letter/etc)", "A4")
  .option("--landscape", "Landscape orientation")
  .option("--print-background", "Print background graphics", true)
  .action(async (path, options, command) => {
    const result = await executeViaDaemon(
      "pdf",
      {
        path,
        format: options.format,
        landscape: options.landscape,
        printBackground: options.printBackground,
      },
      command.parent,
    );
    console.log(result);
  });

// Set 系列命令
program
  .command("set <subcommand> [args...]")
  .description("Set browser settings (viewport/geo/offline/headers/media)")
  .action(async (subcommand, args, _options, command) => {
    const params: any = { subcommand };

    switch (subcommand) {
      case "viewport":
        params.width = Number.parseInt(args[0]);
        params.height = Number.parseInt(args[1]);
        break;
      case "geo":
        params.latitude = Number.parseFloat(args[0]);
        params.longitude = Number.parseFloat(args[1]);
        break;
      case "offline":
        params.enabled = args[0] === "on" || args[0] === "true";
        break;
      case "headers":
        params.headers = JSON.parse(args[0]);
        break;
      case "media":
        params.scheme = args[0];
        break;
    }

    const result = await executeViaDaemon("set", params, command.parent);
    console.log(result);
  });

// Mouse 命令
program
  .command("mouse <action> [args...]")
  .description("Mouse control (move/down/up/wheel)")
  .action(async (action, args, _options, command) => {
    const params: any = { action };

    switch (action) {
      case "move":
        params.x = Number.parseInt(args[0]);
        params.y = Number.parseInt(args[1]);
        break;
      case "down":
      case "up":
        params.button = args[0] || "left";
        break;
      case "wheel":
        params.deltaY = Number.parseInt(args[0]);
        params.deltaX = args[1] ? Number.parseInt(args[1]) : 0;
        break;
    }

    const result = await executeViaDaemon("mouse", params, command.parent);
    console.log(result);
  });

// Keyboard 命令
program
  .command("keydown <key>")
  .description("Press and hold key")
  .action(async (key, _options, command) => {
    const result = await executeViaDaemon("keydown", { key }, command.parent);
    console.log(result);
  });

program
  .command("keyup <key>")
  .description("Release key")
  .action(async (key, _options, command) => {
    const result = await executeViaDaemon("keyup", { key }, command.parent);
    console.log(result);
  });

// Debug 命令
program
  .command("console [action]")
  .description("View/clear console logs")
  .action(async (action, _options, command) => {
    const result = await executeViaDaemon("console", { action }, command.parent);
    if (Array.isArray(result)) {
      console.log(result.join("\n"));
    } else {
      console.log(result);
    }
  });

program
  .command("errors [action]")
  .description("View/clear page errors")
  .action(async (action, _options, command) => {
    const result = await executeViaDaemon("errors", { action }, command.parent);
    if (Array.isArray(result)) {
      console.log(result.join("\n"));
    } else {
      console.log(result);
    }
  });

program
  .command("highlight <selector>")
  .description("Highlight element on page")
  .action(async (selector, _options, command) => {
    const result = await executeViaDaemon("highlight", { selector }, command.parent);
    console.log(result);
  });

// Info commands
program
  .command("snapshot")
  .description("Get page snapshot")
  .option("-i, --interactive", "Show only interactive elements")
  .option("-f, --full", "Show all elements")
  .option("-r, --raw", "Output raw JSON")
  .option("-o, --output <file>", "Output to file")
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "snapshot",
      {
        interactive: options.interactive,
        full: options.full,
        raw: options.raw,
      },
      command.parent,
    );

    if (options.output) {
      await Bun.write(options.output, result);
      console.log(`Snapshot saved to: ${options.output}`);
    } else {
      console.log(result);
    }
  });

program
  .command("screenshot")
  .description("Take a screenshot")
  .option("-o, --output <file>", "Output file", "screenshot.png")
  .option("--full-page", "Capture full page")
  .option("--selector <selector>", "Capture specific element")
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "screenshot",
      {
        output: options.output,
        fullPage: options.fullPage,
        selector: options.selector,
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("evaluate <script>")
  .description("Execute JavaScript in page context")
  .action(async (script, _options, command) => {
    const result = await executeViaDaemon("evaluate", { script }, command.parent);
    console.log(result);
  });

program
  .command("url")
  .description("Get current URL")
  .action(async (_options, command) => {
    const result = await executeViaDaemon("url", {}, command.parent);
    console.log(result);
  });

program
  .command("title")
  .description("Get page title")
  .action(async (_options, command) => {
    const result = await executeViaDaemon("title", {}, command.parent);
    console.log(result);
  });

// Extract commands
program
  .command("extract-table")
  .description("Extract table data from page")
  .option("--selector <selector>", "Table selector")
  .option("--no-headers", "Exclude headers")
  .option("--max-rows <number>", "Maximum number of rows", "1000")
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "extract-table",
      {
        selector: options.selector,
        includeHeaders: options.headers,
        maxRows: Number.parseInt(options.maxRows),
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("extract-list")
  .description("Extract list data from page")
  .option("--selector <selector>", "List container selector")
  .option("--pattern <pattern>", "Item pattern (auto by default)", "auto")
  .option("--max-items <number>", "Maximum number of items", "1000")
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "extract-list",
      {
        selector: options.selector,
        pattern: options.pattern,
        maxItems: Number.parseInt(options.maxItems),
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("extract-form")
  .description("Extract form field data from page")
  .option("--selector <selector>", "Form selector")
  .option("--include-disabled", "Include disabled fields")
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "extract-form",
      {
        selector: options.selector,
        includeDisabled: options.includeDisabled,
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("extract-meta")
  .description("Extract page metadata (SEO, OpenGraph, Schema.org)")
  .option(
    "--include <types>",
    "Metadata types (seo,og,twitter,schema,other)",
    "seo,og,twitter,schema,other",
  )
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "extract-meta",
      {
        include: options.include.split(","),
      },
      command.parent,
    );
    console.log(result);
  });

// Network commands
program
  .command("network-start")
  .description("Start network request monitoring")
  .option("--filter <types>", "Resource types (xhr,fetch,document,script,image,font)", "xhr,fetch")
  .option("--url-pattern <pattern>", "URL pattern to match (glob)")
  .option("--methods <methods>", "HTTP methods (GET,POST,PUT,DELETE)")
  .action(async (options, command) => {
    const result = await executeViaDaemon(
      "network-start",
      {
        filter: options.filter.split(","),
        urlPattern: options.urlPattern,
        methods: options.methods ? options.methods.split(",") : undefined,
      },
      command.parent,
    );
    console.log(result);
  });

program
  .command("network-stop <listener-id>")
  .description("Stop network monitoring and get captured requests")
  .action(async (listenerId, _options, command) => {
    const result = await executeViaDaemon(
      "network-stop",
      {
        listenerId,
      },
      command.parent,
    );
    console.log(result);
  });

// Session commands
program
  .command("sessions")
  .description("List all sessions")
  .action(async () => {
    try {
      const sessions = await daemonClient.listSessions();
      console.log("Active Sessions:");
      if (sessions.length === 0) {
        console.log("  No active sessions");
      } else {
        for (const session of sessions) {
          console.log(`  - ${session.name} (${session.status})`);
        }
      }
    } catch (error) {
      handleError(error);
    }
  });

program
  .command("close")
  .description("Close current session")
  .action(async (_options, command) => {
    try {
      const sessionName = getSessionName(command.parent);
      const closed = await daemonClient.closeSession(sessionName);

      if (closed) {
        console.log(`Session closed: ${sessionName}`);
      } else {
        console.log(`Session not found: ${sessionName}`);
      }
    } catch (error) {
      handleError(error);
    }
  });

// Daemon management commands
program
  .command("daemon <action>")
  .description("Manage daemon (start/stop/status/restart)")
  .action(async (action) => {
    try {
      const { spawnSync } = await import("node:child_process");
      const { join } = await import("node:path");

      // Get the project root directory
      const projectRoot = join(import.meta.dir, "..");
      const daemonScript = join(projectRoot, "src/daemon/main.ts");

      const result = spawnSync("bun", [daemonScript, action], {
        stdio: "inherit",
        cwd: projectRoot,
      });

      process.exit(result.status || 0);
    } catch (error) {
      console.error("Failed to execute daemon command:", error);
      process.exit(1);
    }
  });

// Config commands
program
  .command("config <action> [key] [value]")
  .description("Manage configuration (list/get/set)")
  .action(async (action, key, value) => {
    try {
      if (action === "list") {
        const result = await configCommands.listConfig();
        console.log(result);
      } else if (action === "get" && key) {
        const result = await configCommands.getConfig(key);
        console.log(result);
      } else if (action === "set" && key && value) {
        const result = await configCommands.setConfig(key, value);
        console.log(result);
      } else {
        throw new Error(`Unknown config action: ${action}`);
      }
    } catch (error) {
      handleError(error);
    }
  });

// Version command
program
  .command("version")
  .description("Show version information")
  .action(() => {
    console.log("hyper-agent-browser v0.3.1 (with daemon architecture)");
    console.log(`Bun v${Bun.version}`);
    console.log("Patchright v1.55.1");
  });

// Helper functions
function getSessionName(parentCommand: any): string {
  return parentCommand.opts().session || "default";
}

function getChannel(parentCommand: any): "chrome" | "msedge" | "chromium" {
  return parentCommand.opts().channel || "chrome";
}

function getTimeout(parentCommand: any): number {
  return Number.parseInt(parentCommand.opts().timeout || "30000");
}

function handleError(error: any) {
  if (error instanceof Error) {
    console.error("Error:", error.message);
    process.exit(getExitCode(error));
  } else {
    console.error("Error:", error);
    process.exit(1);
  }
}

program.parse();
