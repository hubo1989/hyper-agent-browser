import type { Page } from "patchright";

export interface NavigationOptions {
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  timeout?: number;
}

export async function open(
  page: Page,
  url: string,
  options: NavigationOptions = {},
): Promise<void> {
  const waitUntil = options.waitUntil || "load";
  const timeout = options.timeout || 30000;

  await page.goto(url, {
    waitUntil,
    timeout,
  });
}

export async function reload(page: Page, options: NavigationOptions = {}): Promise<void> {
  const waitUntil = options.waitUntil || "load";
  const timeout = options.timeout || 30000;

  await page.reload({
    waitUntil,
    timeout,
  });
}

export async function back(page: Page, options: NavigationOptions = {}): Promise<void> {
  const waitUntil = options.waitUntil || "load";
  const timeout = options.timeout || 30000;

  await page.goBack({
    waitUntil,
    timeout,
  });
}

export async function forward(page: Page, options: NavigationOptions = {}): Promise<void> {
  const waitUntil = options.waitUntil || "load";
  const timeout = options.timeout || 30000;

  await page.goForward({
    waitUntil,
    timeout,
  });
}
