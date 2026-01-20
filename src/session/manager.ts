import type { Session } from "./store";
import { SessionStore } from "./store";

export interface SessionManagerOptions {
  baseDir?: string;
}

export class SessionManager {
  private store: SessionStore;
  private activeSessions: Map<string, Session>;

  constructor(options: SessionManagerOptions = {}) {
    this.store = new SessionStore(options.baseDir);
    this.activeSessions = new Map();
  }

  async getOrCreate(
    name: string,
    channel: "chrome" | "msedge" | "chromium" = "chrome",
  ): Promise<Session> {
    // Check in-memory cache
    if (this.activeSessions.has(name)) {
      return this.activeSessions.get(name)!;
    }

    // Try to load from disk
    let session = await this.store.load(name);

    if (!session) {
      // Create new session
      session = await this.store.create(name, channel);
    }

    this.activeSessions.set(name, session);
    return session;
  }

  async update(name: string, updates: Partial<Session>): Promise<Session> {
    const session = await this.store.update(name, updates);
    if (!session) {
      throw new Error(`Session not found: ${name}`);
    }

    this.activeSessions.set(name, session);
    return session;
  }

  async markRunning(name: string, wsEndpoint: string, pid?: number): Promise<Session> {
    return this.update(name, {
      status: "running",
      wsEndpoint,
      pid,
    });
  }

  async markStopped(name: string): Promise<Session> {
    return this.update(name, {
      status: "stopped",
      wsEndpoint: undefined,
      pid: undefined,
    });
  }

  async updatePageInfo(name: string, url: string, title: string): Promise<Session> {
    return this.update(name, { url, title });
  }

  async list(): Promise<Session[]> {
    return this.store.list();
  }

  async delete(name: string): Promise<boolean> {
    this.activeSessions.delete(name);
    return this.store.delete(name);
  }

  async updateActivity(name: string): Promise<void> {
    await this.store.updateActivity(name);
    const session = await this.store.load(name);
    if (session) {
      this.activeSessions.set(name, session);
    }
  }

  async close(name: string): Promise<void> {
    await this.markStopped(name);
    this.activeSessions.delete(name);
  }

  async closeAll(): Promise<void> {
    const sessions = await this.list();
    for (const session of sessions) {
      if (session.status === "running") {
        await this.close(session.name);
      }
    }
    this.activeSessions.clear();
  }

  isRunning(session: Session): boolean {
    return session.status === "running" && !!session.wsEndpoint;
  }

  async get(name: string): Promise<Session | null> {
    if (this.activeSessions.has(name)) {
      return this.activeSessions.get(name)!;
    }
    return this.store.load(name);
  }
}
