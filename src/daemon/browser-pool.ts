import { BrowserManager } from "../browser/manager";
import type { BrowserManagerOptions } from "../browser/manager";
import type { Session } from "../session/store";

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
        if (browser.isConnected()) {
          return browser;
        }
      } catch (error) {
        console.error(`Failed to reconnect browser for session ${key}:`, error);
      }

      // 重连失败，移除旧实例并创建新的
      console.log(`Removing stale browser instance for session ${key}`);
      this.browsers.delete(key);
    }

    // 创建新的浏览器实例
    console.log(`Creating new browser instance for session ${key}`);
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

    try {
      await browser.close();
    } catch (error) {
      console.error(`Error closing browser for session ${sessionName}:`, error);
    }
    this.browsers.delete(sessionName);
    return true;
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.browsers.entries()).map(async ([name, browser]) => {
      try {
        await browser.close();
      } catch (error) {
        console.error(`Error closing browser for session ${name}:`, error);
      }
    });
    await Promise.all(closePromises);
    this.browsers.clear();
  }

  getActiveSessions(): string[] {
    return Array.from(this.browsers.keys());
  }

  size(): number {
    return this.browsers.size;
  }

  /**
   * 清理所有无效的浏览器实例
   */
  async cleanup(): Promise<void> {
    const toRemove: string[] = [];

    for (const [name, browser] of this.browsers.entries()) {
      if (!browser.isConnected()) {
        toRemove.push(name);
      }
    }

    for (const name of toRemove) {
      console.log(`Cleaning up disconnected browser: ${name}`);
      this.browsers.delete(name);
    }
  }
}
