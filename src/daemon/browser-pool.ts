import type { Session } from "../session/store";
import { BrowserManager } from "../browser/manager";
import type { BrowserManagerOptions } from "../browser/manager";

/**
 * BrowserPool 管理多个 Session 的浏览器实例
 */
export class BrowserPool {
  private browsers: Map<string, BrowserManager> = new Map();

  async get(session: Session, options: BrowserManagerOptions = {}): Promise<BrowserManager> {
    const key = session.name;

    if (this.browsers.has(key)) {
      const browser = this.browsers.get(key)!;

      // 检查浏览器是否还连接
      if (browser.isConnected()) {
        return browser;
      }

      // 浏览器断开连接，尝试重连
      try {
        await browser.connect();
        return browser;
      } catch (error) {
        console.error(`Failed to reconnect browser for session ${key}:`, error);
        // 重连失败，移除旧实例
        this.browsers.delete(key);
      }
    }

    // 创建新的浏览器实例
    const browser = new BrowserManager(session, options);
    await browser.connect();
    this.browsers.set(key, browser);

    return browser;
  }

  async close(sessionName: string): Promise<boolean> {
    const browser = this.browsers.get(sessionName);
    if (!browser) {
      return false;
    }

    await browser.close();
    this.browsers.delete(sessionName);
    return true;
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.browsers.values()).map(b => b.close());
    await Promise.all(closePromises);
    this.browsers.clear();
  }

  getActiveSessions(): string[] {
    return Array.from(this.browsers.keys());
  }

  size(): number {
    return this.browsers.size;
  }
}
