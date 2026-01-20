import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CommandRequest, CommandResponse } from "./server";

const CONFIG_FILE = join(homedir(), ".hba", "daemon.json");

export class DaemonClient {
  private host: string = "127.0.0.1";
  private port: number = 9527;

  async ensureDaemonRunning(): Promise<void> {
    // Load daemon config
    if (existsSync(CONFIG_FILE)) {
      try {
        const content = await readFile(CONFIG_FILE, "utf-8");
        const config = JSON.parse(content);
        this.host = config.host;
        this.port = config.port;
      } catch {
        // Use defaults
      }
    }

    // Check if daemon is running
    const healthy = await this.checkHealth();
    if (healthy) {
      return;
    }

    // Auto-start daemon
    console.log("Starting daemon...");
    await this.startDaemon();

    // Wait for daemon to be ready
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (await this.checkHealth()) {
        console.log("Daemon started successfully");
        return;
      }
    }

    throw new Error("Failed to start daemon");
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.host}:${this.port}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async startDaemon(): Promise<void> {
    // Start daemon in background
    const projectRoot = join(import.meta.dir, "../..");
    const daemonScript = join(projectRoot, "src/daemon/main.ts");

    const proc = Bun.spawn({
      cmd: ["bun", daemonScript, "start"],
      cwd: projectRoot,
      stdout: "ignore",
      stderr: "ignore",
      stdin: "ignore",
    });

    proc.unref();
  }

  async execute(request: CommandRequest): Promise<CommandResponse> {
    await this.ensureDaemonRunning();

    try {
      const response = await fetch(`http://${this.host}:${this.port}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(60000), // 60s timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Daemon error: ${error}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error("Command timed out");
      }
      throw error;
    }
  }

  async closeSession(session: string): Promise<boolean> {
    await this.ensureDaemonRunning();

    try {
      const response = await fetch(`http://${this.host}:${this.port}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session }),
      });

      const result = await response.json();
      return result.closed;
    } catch {
      return false;
    }
  }

  async listSessions(): Promise<any[]> {
    await this.ensureDaemonRunning();

    try {
      const response = await fetch(`http://${this.host}:${this.port}/sessions`);
      const result = await response.json();
      return result.sessions || [];
    } catch {
      return [];
    }
  }
}
