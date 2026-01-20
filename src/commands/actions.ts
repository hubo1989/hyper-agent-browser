import type { Locator, Page } from "patchright";
import { parseSelector } from "../utils/selector";

// Global reference store for element mappings
let globalReferenceStore: any = null;

export function setReferenceStore(store: any) {
  globalReferenceStore = store;
}

async function getLocator(page: Page, selector: string): Promise<Locator> {
  const parsed = parseSelector(selector);

  switch (parsed.type) {
    case "ref": {
      // Try to resolve @eN reference to actual selector
      if (!globalReferenceStore) {
        throw new Error(
          `Element reference @${parsed.value} requires a snapshot first. Run 'hab snapshot -i' to generate element references.`,
        );
      }

      const actualSelector = globalReferenceStore.get(parsed.value);
      if (!actualSelector) {
        throw new Error(
          `Element reference @${parsed.value} not found. Run 'hab snapshot -i' to update element references.`,
        );
      }

      // Use the mapped CSS selector
      return page.locator(actualSelector);
    }
    case "css":
      return page.locator(parsed.value);
    case "text":
      return page.getByText(parsed.value);
    case "xpath":
      return page.locator(`xpath=${parsed.value}`);
    default:
      throw new Error(`Unknown selector type: ${parsed.type}`);
  }
}

export async function click(page: Page, selector: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.click();
}

export async function fill(page: Page, selector: string, value: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.fill(value);
}

export async function type(page: Page, selector: string, text: string, delay = 0): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.pressSequentially(text, { delay });
}

export async function press(page: Page, key: string): Promise<void> {
  await page.keyboard.press(key);
}

export async function scroll(
  page: Page,
  direction: "up" | "down" | "left" | "right",
  amount = 500,
  selector?: string,
): Promise<void> {
  if (selector) {
    const locator = await getLocator(page, selector);
    const element = await locator.elementHandle();
    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    await element.evaluate(
      (el, { direction, amount }) => {
        const scrollMap = {
          down: { top: amount, left: 0 },
          up: { top: -amount, left: 0 },
          right: { top: 0, left: amount },
          left: { top: 0, left: -amount },
        };
        const scroll = scrollMap[direction as keyof typeof scrollMap];
        el.scrollBy(scroll);
      },
      { direction, amount },
    );
  } else {
    await page.evaluate(
      ({ direction, amount }) => {
        const scrollMap = {
          down: { top: amount, left: 0 },
          up: { top: -amount, left: 0 },
          right: { top: 0, left: amount },
          left: { top: 0, left: -amount },
        };
        const scroll = scrollMap[direction as keyof typeof scrollMap];
        // @ts-ignore - window is available in browser context
        window.scrollBy(scroll);
      },
      { direction, amount },
    );
  }
}

export async function hover(page: Page, selector: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.hover();
}

export async function select(page: Page, selector: string, value: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.selectOption(value);
}

export interface WaitOptions {
  timeout?: number;
  text?: string;
  url?: string;
  fn?: string;
  load?: "load" | "domcontentloaded" | "networkidle";
}

export async function wait(
  page: Page,
  condition: string | number,
  options: WaitOptions = {},
): Promise<void> {
  const timeout = options.timeout || 30000;

  // Wait for milliseconds
  if (typeof condition === "number") {
    await page.waitForTimeout(condition);
    return;
  }

  // Wait for navigation
  if (condition === "navigation") {
    await page.waitForLoadState("load", { timeout });
    return;
  }

  // Wait for load state (--load networkidle)
  if (options.load) {
    await page.waitForLoadState(options.load, { timeout });
    return;
  }

  // Wait for text to appear (--text "Welcome")
  if (options.text) {
    await page.waitForSelector(`text=${options.text}`, { timeout });
    return;
  }

  // Wait for URL pattern (--url "**/dashboard")
  if (options.url) {
    await page.waitForURL(options.url, { timeout });
    return;
  }

  // Wait for JavaScript condition (--fn "window.loaded === true")
  if (options.fn) {
    await page.waitForFunction(options.fn, { timeout });
    return;
  }

  // Wait for selector to be visible
  if (condition.startsWith("selector=")) {
    const selector = condition.slice(9);
    const locator = await getLocator(page, selector);
    await locator.waitFor({ state: "visible", timeout });
    return;
  }

  // Wait for selector to be hidden
  if (condition.startsWith("hidden=")) {
    const selector = condition.slice(7);
    const locator = await getLocator(page, selector);
    await locator.waitFor({ state: "hidden", timeout });
    return;
  }

  throw new Error(`Unknown wait condition: ${condition}`);
}

// ============ 第一批高优先级功能 ============

export async function check(page: Page, selector: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.check();
}

export async function uncheck(page: Page, selector: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.uncheck();
}

export async function dblclick(page: Page, selector: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.dblclick();
}

export async function focus(page: Page, selector: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.focus();
}

export async function upload(page: Page, selector: string, files: string | string[]): Promise<void> {
  const locator = await getLocator(page, selector);
  const filePaths = Array.isArray(files) ? files : [files];
  await locator.setInputFiles(filePaths);
}

export async function scrollIntoView(page: Page, selector: string): Promise<void> {
  const locator = await getLocator(page, selector);
  await locator.scrollIntoViewIfNeeded();
}

export async function drag(page: Page, sourceSelector: string, targetSelector: string): Promise<void> {
  const source = await getLocator(page, sourceSelector);
  const target = await getLocator(page, targetSelector);
  await source.dragTo(target);
}
