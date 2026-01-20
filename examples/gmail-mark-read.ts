#!/usr/bin/env bun
/**
 * Gmail 未读邮件标记为已读
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "patchright";

async function main() {
  const sessionName = "gmail";
  const sessionDir = join(homedir(), ".hab", "sessions", sessionName);
  const userDataDir = join(sessionDir, "userdata");

  console.log("🚀 启动浏览器（使用已登录的 Gmail profile）...");
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: false, // 显示浏览器以便观察
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || (await context.newPage());

  try {
    console.log("📡 打开 Gmail...");
    await page.goto("https://mail.google.com/mail/u/0/#inbox", {
      waitUntil: "load",
      timeout: 60000,
    });

    console.log("⏳ 等待页面加载...");
    await page.waitForTimeout(5000);

    // 检查是否需要登录
    const currentUrl = page.url();
    if (currentUrl.includes("accounts.google.com")) {
      console.log("⚠️  需要登录。请在浏览器中完成登录...");
      console.log("等待 60 秒供你登录...");
      await page.waitForTimeout(60000);
    }

    console.log("🔍 查找未读邮件...");

    // Gmail 的全选按钮
    const selectAllButton = 'div[role="checkbox"][aria-label*="全选"]';

    try {
      // 等待收件箱加载
      await page.waitForSelector('div[role="main"]', { timeout: 10000 });

      // 点击全选
      await page.click(selectAllButton);
      console.log("✅ 已全选当前页面的邮件");

      await page.waitForTimeout(1000);

      // 查找"标记为已读"按钮
      // Gmail 的已读按钮通常是一个带有特定 aria-label 的按钮
      const markAsReadButton = 'div[aria-label*="标为已读"]';

      await page.click(markAsReadButton);
      console.log("✅ 已标记为已读");

      await page.waitForTimeout(2000);

      console.log("🎉 操作完成！");
    } catch (error) {
      console.log("⚠️  自动操作失败，可能需要手动操作");
      console.log("错误:", error.message);
      console.log("\n请在打开的浏览器中手动完成操作");
      console.log("按 Enter 键关闭浏览器...");

      // 等待用户按键
      await new Promise((resolve) => {
        process.stdin.once("data", resolve);
      });
    }
  } catch (error) {
    console.error("❌ 错误:", error);
    throw error;
  } finally {
    console.log("🔚 保持浏览器打开 10 秒以便查看结果...");
    await page.waitForTimeout(10000);
    console.log("关闭浏览器...");
    await context.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
