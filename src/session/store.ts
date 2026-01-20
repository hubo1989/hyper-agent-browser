import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const SessionSchema = z.object({
  name: z.string(),
  status: z.enum(["running", "stopped"]),
  channel: z.enum(["chrome", "msedge", "chromium"]),
  userDataDir: z.string(),
  url: z.string().optional(),
  title: z.string().optional(),
  pid: z.number().optional(),
  wsEndpoint: z.string().optional(),
  createdAt: z.number(),
  lastActiveAt: z.number(),
});

export type Session = z.infer<typeof SessionSchema>;

export class SessionStore {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || join(homedir(), ".hab", "sessions");
  }

  private getSessionDir(name: string): string {
    return join(this.baseDir, name);
  }

  private getSessionFile(name: string): string {
    return join(this.getSessionDir(name), "session.json");
  }

  private getUserDataDir(name: string): string {
    return join(this.getSessionDir(name), "userdata");
  }

  async ensureBaseDir(): Promise<void> {
    if (!existsSync(this.baseDir)) {
      await mkdir(this.baseDir, { recursive: true, mode: 0o700 });
    }
  }

  async exists(name: string): Promise<boolean> {
    return existsSync(this.getSessionFile(name));
  }

  async load(name: string): Promise<Session | null> {
    const file = this.getSessionFile(name);
    if (!existsSync(file)) {
      return null;
    }

    try {
      const content = await readFile(file, "utf-8");
      const data = JSON.parse(content);
      return SessionSchema.parse(data);
    } catch (error) {
      console.error(`Failed to load session ${name}:`, error);
      return null;
    }
  }

  async save(session: Session): Promise<void> {
    await this.ensureBaseDir();
    const sessionDir = this.getSessionDir(session.name);

    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true, mode: 0o700 });
    }

    const file = this.getSessionFile(session.name);
    const content = JSON.stringify(session, null, 2);
    await writeFile(file, content, "utf-8");

    // Security: Set file permissions to 0o600 (owner read/write only)
    // Protects wsEndpoint from being read by other processes
    const { chmod } = await import("node:fs/promises");
    await chmod(file, 0o600);
  }

  async create(name: string, channel: "chrome" | "msedge" | "chromium"): Promise<Session> {
    await this.ensureBaseDir();

    const sessionDir = this.getSessionDir(name);
    const userDataDir = this.getUserDataDir(name);

    if (!existsSync(sessionDir)) {
      await mkdir(sessionDir, { recursive: true, mode: 0o700 });
    }

    if (!existsSync(userDataDir)) {
      await mkdir(userDataDir, { recursive: true, mode: 0o700 });
    }

    const now = Date.now();
    const session: Session = {
      name,
      status: "stopped",
      channel,
      userDataDir,
      createdAt: now,
      lastActiveAt: now,
    };

    await this.save(session);
    return session;
  }

  async update(name: string, updates: Partial<Session>): Promise<Session | null> {
    const session = await this.load(name);
    if (!session) {
      return null;
    }

    const updated = {
      ...session,
      ...updates,
      lastActiveAt: Date.now(),
    };

    await this.save(updated);
    return updated;
  }

  async list(): Promise<Session[]> {
    await this.ensureBaseDir();

    if (!existsSync(this.baseDir)) {
      return [];
    }

    const sessions: Session[] = [];

    // Bun's readdir with withFileTypes not fully compatible, fallback to simple approach
    const { readdirSync } = await import("node:fs");
    const dirs = readdirSync(this.baseDir, { withFileTypes: true });

    for (const entry of dirs) {
      if (entry.isDirectory()) {
        const session = await this.load(entry.name);
        if (session) {
          sessions.push(session);
        }
      }
    }

    return sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }

  async delete(name: string): Promise<boolean> {
    const sessionDir = this.getSessionDir(name);
    if (!existsSync(sessionDir)) {
      return false;
    }

    const { rmSync } = await import("node:fs");
    rmSync(sessionDir, { recursive: true, force: true });
    return true;
  }

  async updateActivity(name: string): Promise<void> {
    const session = await this.load(name);
    if (session) {
      session.lastActiveAt = Date.now();
      await this.save(session);
    }
  }
}
