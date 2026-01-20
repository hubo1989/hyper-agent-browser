import * as actionCommands from "../commands/actions";
import * as advancedCommands from "../commands/advanced";
import * as getterCommands from "../commands/getters";
import * as infoCommands from "../commands/info";
import * as navigationCommands from "../commands/navigation";
import { SessionManager } from "../session/manager";
import { ReferenceStore } from "../snapshot/reference-store";
import { formatError } from "../utils/errors";
import { BrowserPool } from "./browser-pool";

export interface DaemonConfig {
  port: number;
  host: string;
}

export interface CommandRequest {
  command: string;
  session: string;
  args: Record<string, any>;
  options: {
    headed?: boolean;
    timeout?: number;
    channel?: "chrome" | "msedge" | "chromium";
  };
}

export interface CommandResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export class DaemonServer {
  private server: any = null;
  private browserPool: BrowserPool;
  private sessionManager: SessionManager;
  private referenceStores: Map<string, ReferenceStore> = new Map();

  constructor(private config: DaemonConfig) {
    this.browserPool = new BrowserPool();
    this.sessionManager = new SessionManager();
  }

  async start(): Promise<void> {
    const self = this;
    this.server = Bun.serve({
      port: this.config.port,
      hostname: this.config.host,

      async fetch(req: Request): Promise<Response> {
        // CORS headers
        const headers = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Content-Type": "application/json",
        };

        // Handle OPTIONS for CORS
        if (req.method === "OPTIONS") {
          return new Response(null, { headers });
        }

        const url = new URL(req.url);

        // Health check
        if (url.pathname === "/health") {
          return Response.json(
            { status: "ok", sessions: self.browserPool.getActiveSessions() },
            { headers },
          );
        }

        // Execute command
        if (url.pathname === "/execute" && req.method === "POST") {
          try {
            const request: CommandRequest = await req.json();
            const response = await self.executeCommand(request);
            return Response.json(response, { headers });
          } catch (error) {
            return Response.json(
              {
                success: false,
                error: error instanceof Error ? formatError(error) : String(error),
              },
              { status: 500, headers },
            );
          }
        }

        // Close session
        if (url.pathname === "/close" && req.method === "POST") {
          try {
            const { session } = await req.json();
            const closed = await self.browserPool.close(session);
            await self.sessionManager.markStopped(session);
            self.referenceStores.delete(session);

            return Response.json({ success: true, closed }, { headers });
          } catch (error) {
            return Response.json(
              {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
              { status: 500, headers },
            );
          }
        }

        // List sessions
        if (url.pathname === "/sessions" && req.method === "GET") {
          const sessions = await self.sessionManager.list();
          return Response.json({ success: true, sessions }, { headers });
        }

        return Response.json({ success: false, error: "Not found" }, { status: 404, headers });
      },
    });

    console.log(`Daemon server started on ${this.config.host}:${this.config.port}`);
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    await this.browserPool.closeAll();
    console.log("Daemon server stopped");
  }

  private async executeCommand(request: CommandRequest): Promise<CommandResponse> {
    const { command, session: sessionName, args, options } = request;

    try {
      // Get or create session
      const session = await this.sessionManager.getOrCreate(
        sessionName,
        options.channel || "chrome",
      );

      // Get browser from pool
      const browser = await this.browserPool.get(session, {
        headed: options.headed || false,
        timeout: options.timeout || 30000,
        channel: options.channel || session.channel,
      });

      // Get page
      const page = await browser.getPage();

      // Get or create reference store for this session
      let referenceStore = this.referenceStores.get(sessionName);
      if (!referenceStore) {
        referenceStore = new ReferenceStore(session);
        await referenceStore.load();
        this.referenceStores.set(sessionName, referenceStore);

        // Set reference store for actions and getters
        actionCommands.setReferenceStore(referenceStore);
        getterCommands.setReferenceStore(referenceStore);
      }

      // Show operation indicator if headed
      if (options.headed) {
        await browser.showOperationIndicator(command);
      }

      let result: any;

      try {
        // Execute command
        switch (command) {
          // Navigation commands
          case "open":
            await navigationCommands.open(page, args.url, {
              waitUntil: args.waitUntil || "load",
              timeout: options.timeout,
            });
            result = `Opened: ${args.url}`;
            break;

          case "reload":
            await navigationCommands.reload(page);
            result = "Page reloaded";
            break;

          case "back":
            await navigationCommands.back(page);
            result = "Navigated back";
            break;

          case "forward":
            await navigationCommands.forward(page);
            result = "Navigated forward";
            break;

          // Action commands
          case "click":
            await actionCommands.click(page, args.selector);
            result = `Clicked: ${args.selector}`;
            break;

          case "fill":
            await actionCommands.fill(page, args.selector, args.value);
            result = `Filled: ${args.selector}`;
            break;

          case "type":
            await actionCommands.type(page, args.selector, args.text, args.delay || 0);
            result = `Typed into: ${args.selector}`;
            break;

          case "press":
            await actionCommands.press(page, args.key);
            result = `Pressed: ${args.key}`;
            break;

          case "scroll":
            await actionCommands.scroll(page, args.direction, args.amount || 500, args.selector);
            result = `Scrolled ${args.direction}`;
            break;

          case "hover":
            await actionCommands.hover(page, args.selector);
            result = `Hovered: ${args.selector}`;
            break;

          case "select":
            await actionCommands.select(page, args.selector, args.value);
            result = `Selected: ${args.value} in ${args.selector}`;
            break;

          case "wait": {
            const conditionValue = /^\d+$/.test(args.condition)
              ? Number.parseInt(args.condition)
              : args.condition;
            await actionCommands.wait(page, conditionValue, {
              timeout: args.timeout ? Number.parseInt(args.timeout) : undefined,
            });
            result = "Wait completed";
            break;
          }

          // 第一批新增 Action 命令
          case "check":
            await actionCommands.check(page, args.selector);
            result = `Checked: ${args.selector}`;
            break;

          case "uncheck":
            await actionCommands.uncheck(page, args.selector);
            result = `Unchecked: ${args.selector}`;
            break;

          case "dblclick":
            await actionCommands.dblclick(page, args.selector);
            result = `Double-clicked: ${args.selector}`;
            break;

          case "focus":
            await actionCommands.focus(page, args.selector);
            result = `Focused: ${args.selector}`;
            break;

          case "upload":
            await actionCommands.upload(page, args.selector, args.files);
            result = `Uploaded files to: ${args.selector}`;
            break;

          case "scrollintoview":
            await actionCommands.scrollIntoView(page, args.selector);
            result = `Scrolled into view: ${args.selector}`;
            break;

          case "drag":
            await actionCommands.drag(page, args.source, args.target);
            result = `Dragged ${args.source} to ${args.target}`;
            break;

          // Get 系列命令
          case "get":
            if (!args.subcommand) {
              throw new Error("Get subcommand required (text/value/attr/html/count/box)");
            }

            switch (args.subcommand) {
              case "text":
                result = await getterCommands.getText(page, args.selector);
                break;
              case "value":
                result = await getterCommands.getValue(page, args.selector);
                break;
              case "attr":
                result = await getterCommands.getAttr(page, args.selector, args.attribute);
                break;
              case "html":
                result = await getterCommands.getHtml(page, args.selector);
                break;
              case "count":
                result = await getterCommands.getCount(page, args.selector);
                break;
              case "box":
                result = await getterCommands.getBox(page, args.selector);
                break;
              default:
                throw new Error(`Unknown get subcommand: ${args.subcommand}`);
            }
            break;

          // Is 系列命令
          case "is":
            if (!args.subcommand) {
              throw new Error("Is subcommand required (visible/enabled/checked/editable/hidden)");
            }

            switch (args.subcommand) {
              case "visible":
                result = await getterCommands.isVisible(page, args.selector);
                break;
              case "enabled":
                result = await getterCommands.isEnabled(page, args.selector);
                break;
              case "checked":
                result = await getterCommands.isChecked(page, args.selector);
                break;
              case "editable":
                result = await getterCommands.isEditable(page, args.selector);
                break;
              case "hidden":
                result = await getterCommands.isHidden(page, args.selector);
                break;
              default:
                throw new Error(`Unknown is subcommand: ${args.subcommand}`);
            }
            break;

          // Info commands
          case "snapshot":
            result = await infoCommands.snapshot(page, {
              interactive: args.interactive,
              full: args.full,
              raw: args.raw,
              referenceStore: referenceStore,
            });
            break;

          case "screenshot":
            result = await infoCommands.screenshot(page, {
              output: args.output,
              fullPage: args.fullPage,
              selector: args.selector,
            });
            break;

          case "evaluate":
            result = await infoCommands.evaluate(page, args.script);
            break;

          case "url":
            result = await page.url();
            break;

          case "title":
            result = await page.title();
            break;

          // Dialog 命令
          case "dialog":
            if (!args.action) {
              throw new Error("Dialog action required (accept/dismiss)");
            }
            if (args.action === "accept") {
              await advancedCommands.dialogAccept(page, args.text);
              result = "Dialog handler set to accept";
            } else if (args.action === "dismiss") {
              await advancedCommands.dialogDismiss(page);
              result = "Dialog handler set to dismiss";
            }
            break;

          // Cookie 命令
          case "cookies":
            if (!args.action) {
              result = await advancedCommands.getCookies(page);
            } else if (args.action === "set") {
              await advancedCommands.setCookie(page, args.name, args.value);
              result = `Cookie set: ${args.name}`;
            } else if (args.action === "clear") {
              await advancedCommands.clearCookies(page);
              result = "Cookies cleared";
            }
            break;

          // Storage 命令
          case "storage":
            if (!args.storageType) {
              throw new Error("Storage type required (local/session)");
            }

            if (args.storageType === "local") {
              if (!args.action) {
                result = await advancedCommands.getLocalStorage(page, args.key);
              } else if (args.action === "set") {
                await advancedCommands.setLocalStorage(page, args.key, args.value);
                result = `LocalStorage set: ${args.key}`;
              } else if (args.action === "clear") {
                await advancedCommands.clearLocalStorage(page);
                result = "LocalStorage cleared";
              }
            } else if (args.storageType === "session") {
              if (!args.action) {
                result = await advancedCommands.getSessionStorage(page, args.key);
              } else if (args.action === "set") {
                await advancedCommands.setSessionStorage(page, args.key, args.value);
                result = `SessionStorage set: ${args.key}`;
              } else if (args.action === "clear") {
                await advancedCommands.clearSessionStorage(page);
                result = "SessionStorage cleared";
              }
            }
            break;

          // PDF 导出
          case "pdf":
            result = await advancedCommands.savePDF(page, {
              path: args.path,
              format: args.format,
              landscape: args.landscape,
              printBackground: args.printBackground,
              margin: args.margin,
            });
            break;

          // Set 系列命令
          case "set":
            if (!args.subcommand) {
              throw new Error("Set subcommand required (viewport/geo/offline/headers/media)");
            }

            switch (args.subcommand) {
              case "viewport":
                await advancedCommands.setViewport(page, args.width, args.height);
                result = `Viewport set to ${args.width}x${args.height}`;
                break;
              case "geo":
                await advancedCommands.setGeolocation(page, args.latitude, args.longitude);
                result = `Geolocation set to ${args.latitude}, ${args.longitude}`;
                break;
              case "offline":
                await advancedCommands.setOffline(page, args.enabled);
                result = `Offline mode: ${args.enabled ? "enabled" : "disabled"}`;
                break;
              case "headers":
                await advancedCommands.setExtraHeaders(page, args.headers);
                result = "Extra headers set";
                break;
              case "media":
                await advancedCommands.setMediaColorScheme(page, args.scheme);
                result = `Color scheme set to ${args.scheme}`;
                break;
              default:
                throw new Error(`Unknown set subcommand: ${args.subcommand}`);
            }
            break;

          // Mouse 命令
          case "mouse":
            if (!args.action) {
              throw new Error("Mouse action required (move/down/up/wheel)");
            }

            switch (args.action) {
              case "move":
                await advancedCommands.mouseMove(page, args.x, args.y);
                result = `Mouse moved to ${args.x}, ${args.y}`;
                break;
              case "down":
                await advancedCommands.mouseDown(page, args.button || "left");
                result = `Mouse ${args.button || "left"} button down`;
                break;
              case "up":
                await advancedCommands.mouseUp(page, args.button || "left");
                result = `Mouse ${args.button || "left"} button up`;
                break;
              case "wheel":
                await advancedCommands.mouseWheel(page, args.deltaY, args.deltaX || 0);
                result = "Mouse wheel scrolled";
                break;
              default:
                throw new Error(`Unknown mouse action: ${args.action}`);
            }
            break;

          // Keyboard 命令
          case "keydown":
            await advancedCommands.keyDown(page, args.key);
            result = `Key down: ${args.key}`;
            break;

          case "keyup":
            await advancedCommands.keyUp(page, args.key);
            result = `Key up: ${args.key}`;
            break;

          // Debug 命令
          case "console":
            if (args.action === "clear") {
              advancedCommands.clearConsoleLogs();
              result = "Console logs cleared";
            } else {
              result = advancedCommands.getConsoleLogs();
            }
            break;

          case "errors":
            if (args.action === "clear") {
              advancedCommands.clearPageErrors();
              result = "Page errors cleared";
            } else {
              result = advancedCommands.getPageErrors();
            }
            break;

          case "highlight":
            await advancedCommands.highlightElement(page, args.selector);
            result = `Highlighted: ${args.selector}`;
            break;

          default:
            throw new Error(`Unknown command: ${command}`);
        }
      } finally {
        // Hide operation indicator
        if (options.headed) {
          await browser.hideOperationIndicator();
        }
      }

      // Update session info after command execution
      const url = await page.url();
      const title = await page.title();
      await this.sessionManager.updatePageInfo(sessionName, url, title);

      // Update session with browser info
      const wsEndpoint = browser.getWsEndpoint();
      const pid = browser.getPid();
      if (wsEndpoint) {
        await this.sessionManager.markRunning(sessionName, wsEndpoint, pid);
      }

      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? formatError(error) : String(error),
      };
    }
  }
}
