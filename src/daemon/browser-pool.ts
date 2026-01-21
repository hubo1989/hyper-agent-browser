import { BrowserManager } from "../browser/manager";
import type { BrowserManagerOptions } from "../browser/manager";
import type { Session } from "../session/store";

interface CachedBrowser {
  manager: BrowserManager;
  options: BrowserManagerOptions;
}

/**
 * BrowserPool 管理多个 Session 的浏览器实例
 */
export class BrowserPool {
  private browsers: Map<string, CachedBrowser> = new Map();

  async get(session: Session, options: BrowserManagerOptions = {}): Promise<BrowserManager> {
    const key = session.name;

    if (this.browsers.has(key)) {
      const cached = this.browsers.get(key)!;
      const browser = cached.manager;

      // 检查选项是否一致（特别是 headed 模式）
      const optionsMismatch = this.hasOptionsMismatch(cached.options, options);

      if (optionsMismatch) {
        console.log(
          `Options mismatch for session ${key} (headed: ${cached.options.headed} -> ${options.headed}), recreating browser`,
        );
        try {
          await browser.close();
        } catch (error) {
          console.error("Error closing browser for options change:", error);
        }
        this.browsers.delete(key);
        // 继续创建新的浏览器实例
      } else if (browser.isConnected()) {
        // 选项一致且浏览器已连接，直接返回
        return browser;
      } else {
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
    }

    // 创建新的浏览器实例
    console.log(
      `Creating new browser instance for session ${key} (headed: ${options.headed ?? false})`,
    );
    const browser = new BrowserManager(session, options);
    await browser.connect();
    this.browsers.set(key, { manager: browser, options: { ...options } });

    return browser;
  }

  /**
   * 检查选项是否有重要变化需要重建浏览器
   */
  private hasOptionsMismatch(
    cached: BrowserManagerOptions,
    requested: BrowserManagerOptions,
  ): boolean {
    // headed 模式变化需要重建浏览器
    if ((cached.headed ?? false) !== (requested.headed ?? false)) {
      return true;
    }
    // channel 变化也需要重建
    if (cached.channel && requested.channel && cached.channel !== requested.channel) {
      return true;
    }
    return false;
  }

  async close(sessionName: string): Promise<boolean> {
    const cached = this.browsers.get(sessionName);
    if (!cached) {
      return false;
    }

    try {
      await cached.manager.close();
    } catch (error) {
      console.error(`Error closing browser for session ${sessionName}:`, error);
    }
    this.browsers.delete(sessionName);
    return true;
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.browsers.entries()).map(async ([name, cached]) => {
      try {
        await cached.manager.close();
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

    for (const [name, cached] of this.browsers.entries()) {
      if (!cached.manager.isConnected()) {
        toRemove.push(name);
      }
    }

    for (const name of toRemove) {
      console.log(`Cleaning up disconnected browser: ${name}`);
      this.browsers.delete(name);
    }
  }
}
