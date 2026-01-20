import type { Page } from "patchright";

export interface WaitIdleOptions {
  timeout?: number;
  strategy?: "network" | "dom" | "both";
  networkIdleTime?: number;
  domStableTime?: number;
  ignoreSelectors?: string[];
}

export interface WaitElementOptions {
  state?: "attached" | "detached" | "visible" | "hidden";
  timeout?: number;
}

/**
 * 等待页面空闲（网络请求完成 + DOM 稳定）
 */
export async function waitIdle(page: Page, options: WaitIdleOptions = {}): Promise<void> {
  const timeout = options.timeout ?? 30000;
  const strategy = options.strategy ?? "both";
  const networkIdleTime = options.networkIdleTime ?? 500;
  const domStableTime = options.domStableTime ?? 500;

  const startTime = Date.now();

  try {
    if (strategy === "network" || strategy === "both") {
      await waitNetworkIdle(page, networkIdleTime, timeout);
    }

    if (strategy === "dom" || strategy === "both") {
      const remainingTimeout = timeout - (Date.now() - startTime);
      if (remainingTimeout <= 0) {
        throw new Error("Timeout before DOM stability check");
      }
      await waitDomStable(page, domStableTime, remainingTimeout, options.ignoreSelectors);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timeout")) {
      // 获取当前状态用于调试
      const state = await getPageState(page);
      throw new WaitTimeoutError(timeout, state);
    }
    throw error;
  }
}

/**
 * 等待网络空闲
 */
async function waitNetworkIdle(page: Page, _idleTime: number, timeout: number): Promise<void> {
  try {
    // 使用 Playwright 的 networkidle 策略
    await page.waitForLoadState("networkidle", { timeout });
  } catch (error) {
    throw new Error(`Network idle timeout after ${timeout}ms`);
  }
}

/**
 * 等待 DOM 稳定
 */
async function waitDomStable(
  page: Page,
  stableTime: number,
  timeout: number,
  ignoreSelectors?: string[],
): Promise<void> {
  try {
    await page.evaluate(
      ({ stableTime, timeout, ignoreSelectors }) => {
        return new Promise((resolve, reject) => {
          const startTime = Date.now();
          let timer: NodeJS.Timeout;

          const observer = new MutationObserver((mutations) => {
            // 过滤掉被忽略的区域的变化
            const relevantMutations = ignoreSelectors
              ? mutations.filter((mutation) => {
                  const target = mutation.target as Element;
                  return !ignoreSelectors.some((selector) => {
                    try {
                      return target.matches?.(selector) || target.closest?.(selector);
                    } catch {
                      return false;
                    }
                  });
                })
              : mutations;

            if (relevantMutations.length === 0) {
              return;
            }

            // 重置计时器
            clearTimeout(timer);

            // 检查是否超时
            if (Date.now() - startTime > timeout) {
              observer.disconnect();
              reject(new Error("DOM stability timeout"));
              return;
            }

            // 设置新的稳定计时器
            timer = setTimeout(() => {
              observer.disconnect();
              resolve(undefined);
            }, stableTime);
          });

          // 开始观察
          observer.observe(document.body, {
            childList: true,
            subtree: true,
          });

          // 初始计时器（如果 DOM 已经稳定）
          timer = setTimeout(() => {
            observer.disconnect();
            resolve(undefined);
          }, stableTime);

          // 超时保护
          setTimeout(() => {
            clearTimeout(timer);
            observer.disconnect();
            reject(new Error("DOM stability timeout"));
          }, timeout);
        });
      },
      { stableTime, timeout, ignoreSelectors },
    );
  } catch (error) {
    throw new Error(`DOM stable timeout after ${timeout}ms`);
  }
}

/**
 * 等待元素出现/消失/可见/隐藏
 */
export async function waitElement(
  page: Page,
  selector: string,
  options: WaitElementOptions = {},
): Promise<void> {
  const state = options.state ?? "visible";
  const timeout = options.timeout ?? 10000;

  try {
    const { parseSelector } = await import("../utils/selector");
    const parsed = parseSelector(selector);

    let locator;
    if (parsed.type === "css") {
      locator = page.locator(parsed.value);
    } else if (parsed.type === "text") {
      locator = page.getByText(parsed.value);
    } else if (parsed.type === "xpath") {
      locator = page.locator(`xpath=${parsed.value}`);
    } else {
      throw new Error(`Unsupported selector type: ${parsed.type}`);
    }

    await locator.waitFor({ state, timeout });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Timeout")) {
      throw new WaitElementTimeoutError(selector, state, timeout);
    }
    throw error;
  }
}

/**
 * 获取页面当前状态（用于调试）
 */
async function getPageState(page: Page): Promise<any> {
  const state: any = {
    network: {
      idle: false,
      pendingRequests: 0,
      requests: [],
    },
    dom: {
      stable: false,
      mutations: 0,
    },
  };

  // 简单检测：如果能成功等待 networkidle，说明网络是空闲的
  try {
    await page.waitForLoadState("networkidle", { timeout: 100 });
    state.network.idle = true;
  } catch {
    state.network.idle = false;
  }

  return state;
}

/**
 * 等待超时错误
 */
class WaitTimeoutError extends Error {
  constructor(timeout: number, state: any) {
    const message = `wait-idle timeout after ${timeout}ms`;
    super(message);
    this.name = "WaitTimeoutError";

    // 在错误消息中包含状态信息
    const stateJson = JSON.stringify(state, null, 2);
    this.message = `${message}\n\nCurrent state:\n${stateJson}\n\nSuggestions:\n- Check pendingRequests and consider adding --exclude-url for slow requests\n- Check recentMutations and consider adding --ignore for animated regions\n- Increase timeout or idle times`;
  }
}

/**
 * 等待元素超时错误
 */
class WaitElementTimeoutError extends Error {
  constructor(selector: string, state: string, timeout: number) {
    const message = `Element not ${state} after ${timeout}ms: ${selector}`;
    super(message);
    this.name = "WaitElementTimeoutError";
  }
}
