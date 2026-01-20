#!/usr/bin/env bun
/**
 * Gmail 交互式分析：登录后获取元素
 */

import { chromium } from "patchright";
import { join } from "node:path";
import { homedir } from "node:os";
import { AccessibilityExtractor } from "../src/snapshot/accessibility";
import { SnapshotFormatter } from "../src/snapshot/formatter";

async function main() {
  const sessionName = "gmail";
  const sessionDir = join(homedir(), ".hab", "sessions", sessionName);
  const userDataDir = join(sessionDir, "userdata");

  console.log("🚀 启动浏览器（有窗口模式）...");
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
      timeout: 60000
    });

    console.log("\n⏸️  请在浏览器中完成以下操作：");
    console.log("1. 如果需要登录，请登录 Gmail");
    console.log("2. 登录后确保在收件箱页面");
    console.log("3. 完成后，回到终端按 Enter 键继续...\n");

    // 等待用户按 Enter
    await new Promise((resolve) => {
      process.stdin.once('data', resolve);
    });

    console.log("\n📸 获取页面快照（只显示可交互元素）...\n");

    const extractor = new AccessibilityExtractor();
    const snapshot = await extractor.extract(page, true);

    const formatter = new SnapshotFormatter();
    const formatted = formatter.format(snapshot, {
      maxElements: 150,
      includeDisabled: false
    });

    console.log(formatted);

    console.log("\n\n✅ 分析完成！");
    console.log("🔍 请在上面的列表中找到：");
    console.log("   • 全选按钮的 @eN 引用");
    console.log("   • 标记为已读按钮的 @eN 引用");
    console.log("\n然后告诉我这两个引用，我将创建自动化脚本");
    console.log("\n浏览器将保持打开 120 秒供你查看...");

    await page.waitForTimeout(120000);

  } catch (error) {
    console.error("❌ 错误:", error);
    throw error;
  } finally {
    console.log("\n关闭浏览器...");
    await context.close();
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
