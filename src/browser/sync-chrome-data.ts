import { existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

/**
 * 同步系统 Chrome Profile 数据到 hba session
 * 只复制登录凭证和 Cookies，不复制扩展（避免冲突）
 */
export function syncChromeData(targetUserDataDir: string): void {
  try {
    const systemChromeProfile = join(
      homedir(),
      "Library/Application Support/Google/Chrome/Default"
    );

    if (!existsSync(systemChromeProfile)) {
      console.log("System Chrome profile not found, skipping sync");
      return;
    }

    // 需要同步的文件列表
    const filesToSync = [
      "Cookies",          // Cookie 数据
      "Login Data",       // 登录凭证
      "Preferences",      // Chrome 偏好设置
      "Web Data",         // 表单自动填充数据
      "Network",          // 网络相关数据
      "Local Storage",    // LocalStorage 数据
    ];

    let syncedCount = 0;

    for (const fileName of filesToSync) {
      const sourcePath = join(systemChromeProfile, fileName);
      const targetPath = join(targetUserDataDir, fileName);

      if (existsSync(sourcePath)) {
        try {
          copyFileSync(sourcePath, targetPath);
          syncedCount++;
        } catch (error) {
          // 某些文件可能被锁定，跳过即可
          console.log(`Skipped ${fileName} (in use)`);
        }
      }
    }

    console.log(`Synced ${syncedCount}/${filesToSync.length} files from system Chrome profile`);
  } catch (error) {
    console.error("Error syncing Chrome data:", error);
    // 不抛出错误，允许继续启动
  }
}
