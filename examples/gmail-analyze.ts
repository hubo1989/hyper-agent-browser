#!/usr/bin/env bun
/**
 * Step 1: 打开 Gmail 并获取页面元素快照
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "patchright";
import { AccessibilityExtractor } from "../src/snapshot/accessibility";
import { SnapshotFormatter } from "../src/snapshot/formatter";

async function main() {
  const sessionName = "gmail";
  const sessionDir = join(homedir(), ".hab", "sessions", sessionName);
  const userDataDir = join(sessionDir, "userdata");

  console.log("🚀 启动浏览器...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 1400, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    console.log("📡 打开 Gmail...");
    await page.goto("https://mail.google.com/mail/u/0/#inbox", {
      waitUntil: "load",
      timeout: 60000,
    });

    console.log("⏳ 等待页面加载...");
    await page.waitForTimeout(8000);

    console.log("\n📸 获取页面快照...\n");

    const extractor = new AccessibilityExtractor();
    const snapshot = await extractor.extract(page, true); // true = 只显示可交互元素

    const formatter = new SnapshotFormatter();
    const formatted = formatter.format(snapshot, {
      maxElements: 100,
      includeDisabled: false,
    });

    console.log(formatted);

    console.log("\n\n🔍 请查看上面的元素列表，找到：");
    console.log("1. 全选按钮 (@eN)");
    console.log("2. 标记为已读按钮 (@eN)");
    console.log("\n浏览器将保持打开 60 秒供你查看...");

    await page.waitForTimeout(60000);
  } catch (error) {
    console.error("❌ 错误:", error);
    throw error;
  } finally {
    console.log("关闭浏览器...");
    await context.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
