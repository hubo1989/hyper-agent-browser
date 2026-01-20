import { chromium } from "patchright";
import type { Browser, BrowserContext, Page } from "patchright";
import type { Session } from "../session/store";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { syncChromeData } from "./sync-chrome-data";

export interface BrowserManagerOptions {
  headed?: boolean;
  timeout?: number;
  channel?: "chrome" | "msedge" | "chromium";
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private session: Session;
  private options: BrowserManagerOptions;

  constructor(session: Session, options: BrowserManagerOptions = {}) {
    this.session = session;
    this.options = {
      headed: options.headed ?? false,
      timeout: options.timeout ?? 30000,
      channel: options.channel ?? session.channel,
    };
  }

  async connect(): Promise<void> {
    // Try to reconnect to existing browser via CDP
    if (this.session.wsEndpoint && await this.isBrowserRunning()) {
      try {
        this.browser = await chromium.connectOverCDP(this.session.wsEndpoint);
        const contexts = this.browser.contexts();

        if (contexts.length > 0) {
          this.context = contexts[0];
          const pages = this.context.pages();
          this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
        } else {
          // Create new context
          this.context = await this.browser.newContext({
            viewport: { width: 1280, height: 720 },
          });
          this.page = await this.context.newPage();
        }

        if (this.options.timeout) {
          this.page.setDefaultTimeout(this.options.timeout);
        }

        console.log(`Reconnected to existing browser (PID: ${this.session.pid})`);
        return;
      } catch (error) {
        console.error("Failed to reconnect, launching new browser:", error);
      }
    }

    // Launch new browser
    await this.launch();
  }

  async launch(): Promise<void> {
    // Sync Chrome data from system profile (only if enabled)
    const syncSystemChrome = process.env.HAB_SYNC_CHROME === 'true';
    if (syncSystemChrome) {
      console.log("Syncing data from system Chrome profile...");
      syncChromeData(this.session.userDataDir);
    }

    const launchArgs = [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ];

    // Check if extensions should be loaded (opt-in via environment variable)
    const loadExtensions = process.env.HAB_LOAD_EXTENSIONS === 'true';

    if (loadExtensions) {
      // Load extensions from Chrome profile
      const extensionPaths = this.loadChromeExtensions();

      // Add extension paths if any found (limit to 10 for better stability)
      if (extensionPaths.length > 0) {
        const limitedExtensions = extensionPaths.slice(0, 10);
        console.log(`Loading ${limitedExtensions.length} Chrome extensions (limited from ${extensionPaths.length} total)...`);
        launchArgs.push(`--load-extension=${limitedExtensions.join(',')}`);

        if (extensionPaths.length > 10) {
          console.log(`Note: Limited to 10 extensions to ensure stability. ${extensionPaths.length - 10} extensions skipped.`);
        }
      }
    } else {
      console.log("Extensions disabled by default. Set HAB_LOAD_EXTENSIONS=true to enable.");
    }

    try {
      // Security: Check if system Keychain should be used (opt-in for security)
      const useSystemKeychain = process.env.HAB_USE_SYSTEM_KEYCHAIN === 'true';

      const ignoreArgs = ["--enable-automation"];

      if (!useSystemKeychain) {
        // Default: Use isolated password store (more secure)
        launchArgs.push("--password-store=basic");
        console.log("🔒 Using isolated password store (secure mode). Set HAB_USE_SYSTEM_KEYCHAIN=true to use system Keychain.");
      } else {
        // Opt-in: Allow system Keychain access
        ignoreArgs.push("--password-store=basic", "--use-mock-keychain");
        console.log("⚠️  Using system Keychain (HAB_USE_SYSTEM_KEYCHAIN=true)");
      }

      if (loadExtensions) {
        ignoreArgs.push("--disable-extensions");
      }

      // Use launchPersistentContext for UserData persistence
      this.context = await chromium.launchPersistentContext(this.session.userDataDir, {
        channel: this.options.channel,
        headless: !this.options.headed,
        args: launchArgs,
        ignoreDefaultArgs: ignoreArgs,
        viewport: { width: 1280, height: 720 },
      });

      // Extract browser from context
      // @ts-ignore - context has _browser property
      this.browser = this.context._browser;

      // Get or create page
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();

      // Set default timeout
      if (this.options.timeout) {
        this.page.setDefaultTimeout(this.options.timeout);
      }

      // @ts-ignore - Browser has process and wsEndpoint methods
      const pid = this.browser?.process?.()?.pid;
      // @ts-ignore
      const wsEndpoint = this.browser?.wsEndpoint?.();

      console.log(`Launched new browser (PID: ${pid}, Extensions: ${loadExtensions ? 'enabled' : 'disabled'})`);
    } catch (error) {
      console.error("Failed to launch browser:", error);
      throw error;
    }
  }

  // Security: Whitelist of trusted extension IDs
  // Users can add their trusted extensions here
  private ALLOWED_EXTENSION_IDS = new Set<string>([
    // Example: MetaMask
    // 'nkbihfbeogaeaoehlefnkodbefgpgknn',
    // Add your trusted extensions here
  ]);

  // Security: Check if extension manifest contains dangerous permissions
  private isExtensionSafe(manifestPath: string): boolean {
    try {
      const { readFileSync } = require('node:fs');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

      // Check for dangerous permissions
      const dangerousPerms = ['debugger', 'webRequest', 'proxy', '<all_urls>', 'webRequestBlocking'];
      const permissions = [
        ...(manifest.permissions || []),
        ...(manifest.host_permissions || []),
        ...(manifest.optional_permissions || [])
      ];

      for (const perm of dangerousPerms) {
        if (permissions.includes(perm)) {
          console.log(`⚠️  Extension blocked: contains dangerous permission '${perm}'`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.log(`⚠️  Failed to validate extension manifest: ${error}`);
      return false;
    }
  }

  private loadChromeExtensions(): string[] {
    const extensionPaths: string[] = [];

    try {
      // Chrome extensions directory
      const chromeExtensionsDir = join(
        homedir(),
        "Library/Application Support/Google/Chrome/Default/Extensions"
      );

      if (!existsSync(chromeExtensionsDir)) {
        console.log("Chrome extensions directory not found, skipping extension loading");
        return extensionPaths;
      }

      // Read all extension directories
      const extensionDirs = readdirSync(chromeExtensionsDir);

      for (const extensionId of extensionDirs) {
        // Skip hidden files and .DS_Store
        if (extensionId.startsWith('.')) continue;

        // Security: Whitelist check (if whitelist is not empty, enforce it)
        if (this.ALLOWED_EXTENSION_IDS.size > 0 && !this.ALLOWED_EXTENSION_IDS.has(extensionId)) {
          console.log(`⚠️  Extension ${extensionId} not in whitelist, skipping`);
          continue;
        }

        const extensionDir = join(chromeExtensionsDir, extensionId);

        try {
          // Check if it's a directory
          const { statSync } = require('node:fs');
          const stat = statSync(extensionDir);
          if (!stat.isDirectory()) continue;

          // Read version subdirectories
          const versions = readdirSync(extensionDir);
          const validVersions = versions.filter(v => !v.startsWith('.'));

          if (validVersions.length === 0) continue;

          // Sort versions and get the latest (simple lexicographic sort)
          const latestVersion = validVersions.sort().reverse()[0];
          const extensionPath = join(extensionDir, latestVersion);

          // Verify the extension path exists and has manifest
          const manifestPath = join(extensionPath, 'manifest.json');
          if (existsSync(manifestPath)) {
            // Security: Validate extension safety
            if (!this.isExtensionSafe(manifestPath)) {
              console.log(`⚠️  Extension ${extensionId} blocked due to dangerous permissions`);
              continue;
            }

            extensionPaths.push(extensionPath);
            console.log(`✅ Loaded safe extension: ${extensionId}`);
          }
        } catch (error) {
          // Skip invalid extension directories
          console.log(`Skipping invalid extension: ${extensionId}`);
          continue;
        }
      }

      console.log(`Found ${extensionPaths.length} valid and safe Chrome extensions to load`);
    } catch (error) {
      console.error("Error loading Chrome extensions:", error);
    }

    return extensionPaths;
  }

  private async isBrowserRunning(): Promise<boolean> {
    if (!this.session.pid) return false;

    try {
      // Check if process exists
      process.kill(this.session.pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.connect();
    }
    return this.page!;
  }

  getContext(): BrowserContext | null {
    return this.context;
  }

  getWsEndpoint(): string | undefined {
    // @ts-ignore - Patchright Browser has wsEndpoint method
    return this.browser?.wsEndpoint?.();
  }

  getPid(): number | undefined {
    // @ts-ignore - Patchright Browser has process method
    return this.browser?.process?.()?.pid;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  isConnected(): boolean {
    return this.browser !== null && this.page !== null;
  }

  // Inject visual indicator for agent operations
  async showOperationIndicator(operation: string): Promise<void> {
    if (!this.page || !this.options.headed) return;

    try {
      await this.page.evaluate((op) => {
        // Remove existing indicator
        const existing = document.getElementById('hab-operation-indicator');
        if (existing) existing.remove();

        // Create new indicator
        const indicator = document.createElement('div');
        indicator.id = 'hab-operation-indicator';
        indicator.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: hab-slide-in 0.3s ease-out;
          ">
            <div style="
              width: 8px;
              height: 8px;
              background: #4ade80;
              border-radius: 50%;
              animation: hab-pulse 1.5s ease-in-out infinite;
            "></div>
            <span>🤖 Agent操作中: ${op}</span>
          </div>
        `;

        // Add animations
        if (!document.getElementById('hab-styles')) {
          const style = document.createElement('style');
          style.id = 'hab-styles';
          style.textContent = `
            @keyframes hab-slide-in {
              from { transform: translateX(400px); opacity: 0; }
              to { transform: translateX(0); opacity: 1; }
            }
            @keyframes hab-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.2); }
            }
          `;
          document.head.appendChild(style);
        }

        document.body.appendChild(indicator);
      }, operation);
    } catch (error) {
      // Silently fail if page is not ready
    }
  }

  async hideOperationIndicator(): Promise<void> {
    if (!this.page || !this.options.headed) return;

    try {
      await this.page.evaluate(() => {
        const indicator = document.getElementById('hab-operation-indicator');
        if (indicator) {
          indicator.style.animation = 'hab-slide-in 0.3s ease-out reverse';
          setTimeout(() => indicator.remove(), 300);
        }
      });
    } catch (error) {
      // Silently fail
    }
  }

  async getCurrentUrl(): Promise<string> {
    const page = await this.getPage();
    return page.url();
  }

  async getTitle(): Promise<string> {
    const page = await this.getPage();
    return page.title();
  }
}
