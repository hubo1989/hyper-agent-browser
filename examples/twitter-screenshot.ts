#!/usr/bin/env bun
/**
 * 推特截图脚本 - 绕过 CLI 的 SingletonLock 问题
 * 在单个进程中完成所有操作
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "patchright";

async function main() {
  const sessionName = "twitter";
  const sessionDir = join(homedir(), ".hab", "sessions", sessionName);
  const userDataDir = join(sessionDir, "userdata");

  // 创建目录
  if (!existsSync(sessionDir)) {
    await mkdir(sessionDir, { recursive: true, mode: 0o700 });
  }

  console.log("🚀 启动浏览器...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 1280, height: 720 },
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    console.log("📡 打开推特首页...");
    await page.goto("https://twitter.com", { waitUntil: "networkidle", timeout: 30000 });

    console.log("⏳ 等待页面完全加载...");
    await page.waitForTimeout(2000);

    console.log("📸 截图中...");
    const screenshotPath = "twitter-homepage.png";
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log(`✅ 截图成功: ${screenshotPath}`);

    // 获取页面信息
    const url = page.url();
    const title = await page.title();
    console.log(`📄 页面标题: ${title}`);
    console.log(`🔗 当前 URL: ${url}`);
  } catch (error) {
    console.error("❌ 错误:", error);
    throw error;
  } finally {
    console.log("🔚 关闭浏览器...");
    await context.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
