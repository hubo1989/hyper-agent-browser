import type { BrowserContext, Page } from "patchright";
import type { Session } from "../session/store";
import { BrowserManager } from "./manager";

export interface BrowserContextOptions {
  headed?: boolean;
  timeout?: number;
  channel?: "chrome" | "msedge" | "chromium";
}

/**
 * Manages browser context lifecycle for a session
 */
export class BrowserContextManager {
  private browserManager: BrowserManager | null = null;
  private session: Session;

  constructor(session: Session) {
    this.session = session;
  }

  async getBrowserManager(options: BrowserContextOptions = {}): Promise<BrowserManager> {
    if (!this.browserManager) {
      this.browserManager = new BrowserManager(this.session, options);
      await this.browserManager.connect();
    }
    return this.browserManager;
  }

  async getPage(options: BrowserContextOptions = {}): Promise<Page> {
    const manager = await this.getBrowserManager(options);
    return manager.getPage();
  }

  async getContext(options: BrowserContextOptions = {}): Promise<BrowserContext | null> {
    const manager = await this.getBrowserManager(options);
    return manager.getContext();
  }

  getWsEndpoint(): string | undefined {
    return this.browserManager?.getWsEndpoint();
  }

  getPid(): number | undefined {
    return this.browserManager?.getPid();
  }

  async showOperationIndicator(operation: string): Promise<void> {
    await this.browserManager?.showOperationIndicator(operation);
  }

  async hideOperationIndicator(): Promise<void> {
    await this.browserManager?.hideOperationIndicator();
  }

  async close(): Promise<void> {
    if (this.browserManager) {
      await this.browserManager.close();
      this.browserManager = null;
    }
  }

  isConnected(): boolean {
    return this.browserManager?.isConnected() ?? false;
  }
}
