import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "patchright";

export interface NetworkListenerConfig {
  id: string;
  sessionDir: string;
  filter: {
    types: string[];
    urlPattern?: string;
    methods?: string[];
  };
  startTime: number;
  status: "active" | "stopped";
}

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  request: {
    headers: Record<string, string>;
    postData?: any;
  };
  response?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body?: any;
  };
  timing: {
    startTime: number;
    endTime?: number;
    duration?: number;
  };
}

export class NetworkListener {
  private config: NetworkListenerConfig;
  private metaFile: string;
  private requestsFile: string;
  private requestCount = 0;
  private cleanup?: () => void;

  constructor(config: NetworkListenerConfig) {
    this.config = config;
    const networkDir = join(config.sessionDir, "network", config.id);
    this.metaFile = join(networkDir, "meta.json");
    this.requestsFile = join(networkDir, "requests.jsonl");
  }

  /**
   * 启动网络监听
   */
  async start(page: Page): Promise<void> {
    // 确保目录存在
    const networkDir = join(this.config.sessionDir, "network", this.config.id);
    if (!existsSync(networkDir)) {
      await mkdir(networkDir, { recursive: true, mode: 0o700 });
    }

    // 保存元数据
    await this.saveMeta();

    // 设置请求拦截
    const requestHandler = async (request: any) => {
      const resourceType = request.resourceType();
      const method = request.method();
      const url = request.url();

      // 过滤资源类型
      if (!this.shouldCapture(resourceType, method, url)) {
        return;
      }

      const requestId = `req_${++this.requestCount}`;
      const requestData: NetworkRequest = {
        id: requestId,
        url,
        method,
        request: {
          headers: request.headers(),
          postData: request.postData(),
        },
        timing: {
          startTime: Date.now(),
        },
      };

      // 等待响应
      try {
        const response = await request.response();
        if (response) {
          requestData.response = {
            status: response.status(),
            statusText: response.statusText(),
            headers: response.headers(),
          };

          // 尝试获取响应体
          try {
            const contentType = response.headers()["content-type"] || "";
            if (contentType.includes("application/json")) {
              requestData.response.body = await response.json();
            } else if (contentType.includes("text/")) {
              requestData.response.body = await response.text();
            }
          } catch {
            // 忽略响应体获取失败
          }

          requestData.timing.endTime = Date.now();
          requestData.timing.duration = requestData.timing.endTime - requestData.timing.startTime;
        }
      } catch {
        // 请求失败
      }

      // 追加到文件
      await this.appendRequest(requestData);
    };

    page.on("request", requestHandler);

    // 保存清理函数
    this.cleanup = () => {
      page.off("request", requestHandler);
    };

    // 设置自动超时清理（1小时）
    setTimeout(
      async () => {
        if (this.config.status === "active") {
          await this.stop();
        }
      },
      60 * 60 * 1000,
    );
  }

  /**
   * 停止监听
   */
  async stop(): Promise<void> {
    this.config.status = "stopped";
    await this.saveMeta();

    if (this.cleanup) {
      this.cleanup();
    }
  }

  /**
   * 获取捕获的请求
   */
  async getRequests(): Promise<NetworkRequest[]> {
    if (!existsSync(this.requestsFile)) {
      return [];
    }

    const content = await readFile(this.requestsFile, "utf-8");
    const lines = content.trim().split("\n");
    return lines.filter((line) => line).map((line) => JSON.parse(line));
  }

  /**
   * 获取监听器信息
   */
  getInfo(): {
    listenerId: string;
    startTime: number;
    status: string;
    filter: any;
  } {
    return {
      listenerId: this.config.id,
      startTime: this.config.startTime,
      status: this.config.status,
      filter: this.config.filter,
    };
  }

  /**
   * 判断是否应该捕获请求
   */
  private shouldCapture(resourceType: string, method: string, url: string): boolean {
    // 资源类型过滤
    const typeMap: Record<string, string> = {
      xhr: "xhr",
      fetch: "fetch",
      document: "document",
      script: "script",
      image: "image",
      font: "font",
      stylesheet: "stylesheet",
    };

    const mappedType = typeMap[resourceType];
    if (!mappedType || !this.config.filter.types.includes(mappedType)) {
      return false;
    }

    // HTTP 方法过滤
    if (this.config.filter.methods && this.config.filter.methods.length > 0) {
      if (!this.config.filter.methods.includes(method)) {
        return false;
      }
    }

    // URL 模式过滤
    if (this.config.filter.urlPattern) {
      const pattern = this.config.filter.urlPattern;
      // 简单的 glob 模式匹配
      const regex = new RegExp(pattern.replace(/\*/g, ".*").replace(/\?/g, "."));
      if (!regex.test(url)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 保存元数据
   */
  private async saveMeta(): Promise<void> {
    await writeFile(this.metaFile, JSON.stringify(this.config, null, 2));
  }

  /**
   * 追加请求数据
   */
  private async appendRequest(request: NetworkRequest): Promise<void> {
    const line = `${JSON.stringify(request)}\n`;
    await appendFile(this.requestsFile, line);
  }
}

/**
 * 生成唯一的监听器 ID
 */
export function generateListenerId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `listener_${timestamp}_${random}`;
}
