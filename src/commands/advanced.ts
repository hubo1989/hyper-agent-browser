import type { Page, Cookie } from "patchright";

// ============ Dialog 对话框处理 ============

export async function setupDialogHandler(page: Page, action: "accept" | "dismiss", promptText?: string): Promise<void> {
  page.on("dialog", async dialog => {
    if (action === "accept") {
      await dialog.accept(promptText);
    } else {
      await dialog.dismiss();
    }
  });
}

export async function dialogAccept(page: Page, text?: string): Promise<void> {
  await setupDialogHandler(page, "accept", text);
}

export async function dialogDismiss(page: Page): Promise<void> {
  await setupDialogHandler(page, "dismiss");
}

// ============ Cookie 管理 ============

export async function getCookies(page: Page): Promise<Cookie[]> {
  const context = page.context();
  return await context.cookies();
}

export async function setCookie(page: Page, name: string, value: string): Promise<void> {
  const context = page.context();
  const url = page.url();

  await context.addCookies([{
    name,
    value,
    url,
  }]);
}

export async function clearCookies(page: Page): Promise<void> {
  const context = page.context();
  await context.clearCookies();
}

// ============ Storage 管理 ============

export async function getLocalStorage(page: Page, key?: string): Promise<any> {
  if (key) {
    return await page.evaluate((k) => localStorage.getItem(k), key);
  }

  return await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        items[key] = localStorage.getItem(key) || "";
      }
    }
    return items;
  });
}

export async function setLocalStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: key, v: value }
  );
}

export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

export async function getSessionStorage(page: Page, key?: string): Promise<any> {
  if (key) {
    return await page.evaluate((k) => sessionStorage.getItem(k), key);
  }

  return await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        items[key] = sessionStorage.getItem(key) || "";
      }
    }
    return items;
  });
}

export async function setSessionStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(
    ({ k, v }) => sessionStorage.setItem(k, v),
    { k: key, v: value }
  );
}

export async function clearSessionStorage(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.clear());
}

// ============ PDF 导出 ============

export interface PDFOptions {
  path: string;
  format?: "Letter" | "Legal" | "Tabloid" | "Ledger" | "A0" | "A1" | "A2" | "A3" | "A4" | "A5" | "A6";
  landscape?: boolean;
  printBackground?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export async function savePDF(page: Page, options: PDFOptions): Promise<string> {
  await page.pdf({
    path: options.path,
    format: options.format || "A4",
    landscape: options.landscape || false,
    printBackground: options.printBackground !== false,
    margin: options.margin,
  });

  return options.path;
}

// ============ 设备模拟 ============

export async function setViewport(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
}

export async function setGeolocation(page: Page, latitude: number, longitude: number): Promise<void> {
  const context = page.context();
  await context.setGeolocation({ latitude, longitude });
}

export async function setOffline(page: Page, offline: boolean): Promise<void> {
  const context = page.context();
  await context.setOffline(offline);
}

export async function setExtraHeaders(page: Page, headers: Record<string, string>): Promise<void> {
  const context = page.context();
  await context.setExtraHTTPHeaders(headers);
}

export async function setMediaColorScheme(page: Page, scheme: "light" | "dark" | "no-preference"): Promise<void> {
  await page.emulateMedia({ colorScheme: scheme });
}

// ============ 鼠标控制 ============

export async function mouseMove(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
}

export async function mouseDown(page: Page, button: "left" | "right" | "middle" = "left"): Promise<void> {
  await page.mouse.down({ button });
}

export async function mouseUp(page: Page, button: "left" | "right" | "middle" = "left"): Promise<void> {
  await page.mouse.up({ button });
}

export async function mouseWheel(page: Page, deltaY: number, deltaX: number = 0): Promise<void> {
  await page.mouse.wheel(deltaX, deltaY);
}

// ============ 键盘控制 ============

export async function keyDown(page: Page, key: string): Promise<void> {
  await page.keyboard.down(key);
}

export async function keyUp(page: Page, key: string): Promise<void> {
  await page.keyboard.up(key);
}

// ============ Console & Errors ============

const consoleLogs: string[] = [];
const pageErrors: string[] = [];

export function setupConsoleCapture(page: Page): void {
  page.on("console", msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
}

export function setupErrorCapture(page: Page): void {
  page.on("pageerror", error => {
    pageErrors.push(error.message);
  });
}

export function getConsoleLogs(): string[] {
  return [...consoleLogs];
}

export function clearConsoleLogs(): void {
  consoleLogs.length = 0;
}

export function getPageErrors(): string[] {
  return [...pageErrors];
}

export function clearPageErrors(): void {
  pageErrors.length = 0;
}

// ============ 元素高亮 ============

export async function highlightElement(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (element && element instanceof HTMLElement) {
      element.style.outline = "3px solid red";
      element.style.outlineOffset = "2px";
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, selector);
}
