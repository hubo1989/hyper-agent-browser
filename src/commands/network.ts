import type { Page } from "patchright";
import type { Session } from "../session/store";
import {
  NetworkListener,
  type NetworkListenerConfig,
  generateListenerId,
} from "../utils/network-listener";

// 存储活动的监听器
const activeListeners = new Map<string, NetworkListener>();

export interface NetworkStartOptions {
  filter?: string[];
  urlPattern?: string;
  methods?: string[];
}

export interface NetworkStopResult {
  listenerId: string;
  startTime: number;
  endTime: number;
  duration: number;
  totalRequests: number;
  requests: any[];
}

/**
 * 开始网络监听
 */
export async function networkStart(
  page: Page,
  session: Session,
  options: NetworkStartOptions = {},
): Promise<string> {
  const listenerId = generateListenerId();

  const config: NetworkListenerConfig = {
    id: listenerId,
    sessionDir: session.userDataDir.replace(/\/userdata$/, ""),
    filter: {
      types: options.filter ?? ["xhr", "fetch"],
      urlPattern: options.urlPattern,
      methods: options.methods,
    },
    startTime: Date.now(),
    status: "active",
  };

  const listener = new NetworkListener(config);
  await listener.start(page);

  activeListeners.set(listenerId, listener);

  const info = listener.getInfo();
  return JSON.stringify(info, null, 2);
}

/**
 * 停止网络监听并返回数据
 */
export async function networkStop(listenerId: string): Promise<string> {
  const listener = activeListeners.get(listenerId);

  if (!listener) {
    throw new Error(`Network listener not found: ${listenerId}`);
  }

  await listener.stop();

  const info = listener.getInfo();
  const requests = await listener.getRequests();

  const result: NetworkStopResult = {
    listenerId,
    startTime: info.startTime,
    endTime: Date.now(),
    duration: Date.now() - info.startTime,
    totalRequests: requests.length,
    requests,
  };

  activeListeners.delete(listenerId);

  return JSON.stringify(result, null, 2);
}

/**
 * 获取所有活动监听器
 */
export function getActiveListeners(): string[] {
  return Array.from(activeListeners.keys());
}

/**
 * 清理会话的所有监听器
 */
export async function cleanupSessionListeners(sessionName: string): Promise<void> {
  const toDelete: string[] = [];

  for (const [id, listener] of activeListeners.entries()) {
    const info = listener.getInfo();
    if (info.listenerId.includes(sessionName)) {
      await listener.stop();
      toDelete.push(id);
    }
  }

  toDelete.forEach((id) => activeListeners.delete(id));
}
