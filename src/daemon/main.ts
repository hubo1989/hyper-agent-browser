#!/usr/bin/env bun
import { DaemonServer } from "./server";
import { existsSync } from "node:fs";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DAEMON_PORT = 9527;
const DAEMON_HOST = "127.0.0.1";
const PID_FILE = join(homedir(), ".hab", "daemon.pid");
const CONFIG_FILE = join(homedir(), ".hab", "daemon.json");

async function saveDaemonInfo(pid: number, port: number, host: string): Promise<void> {
  const config = { pid, port, host, startedAt: Date.now() };
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  await writeFile(PID_FILE, String(pid));
}

async function loadDaemonInfo(): Promise<{ pid: number; port: number; host: string } | null> {
  if (!existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const content = await readFile(CONFIG_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function removeDaemonInfo(): Promise<void> {
  try {
    if (existsSync(PID_FILE)) await unlink(PID_FILE);
    if (existsSync(CONFIG_FILE)) await unlink(CONFIG_FILE);
  } catch {
    // Ignore errors
  }
}

async function isDaemonRunning(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function checkHealth(host: string, port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "start") {
    // Check if daemon is already running
    const info = await loadDaemonInfo();
    if (info) {
      const running = await isDaemonRunning(info.pid);
      const healthy = await checkHealth(info.host, info.port);

      if (running && healthy) {
        console.log(`Daemon already running on ${info.host}:${info.port} (PID: ${info.pid})`);
        process.exit(0);
      }

      // Daemon process exists but not healthy, clean up
      await removeDaemonInfo();
    }

    // Start daemon
    const server = new DaemonServer({ port: DAEMON_PORT, host: DAEMON_HOST });
    await server.start();

    // Save daemon info
    await saveDaemonInfo(process.pid, DAEMON_PORT, DAEMON_HOST);

    console.log(`Daemon started on ${DAEMON_HOST}:${DAEMON_PORT} (PID: ${process.pid})`);

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("\nShutting down daemon...");
      await server.stop();
      await removeDaemonInfo();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep process alive
    await new Promise(() => {});
  } else if (command === "stop") {
    const info = await loadDaemonInfo();
    if (!info) {
      console.log("Daemon is not running");
      process.exit(0);
    }

    const running = await isDaemonRunning(info.pid);
    if (!running) {
      console.log("Daemon is not running (stale PID file)");
      await removeDaemonInfo();
      process.exit(0);
    }

    // Send SIGTERM to daemon
    try {
      process.kill(info.pid, "SIGTERM");
      console.log(`Stopped daemon (PID: ${info.pid})`);

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Force cleanup
      await removeDaemonInfo();
    } catch (error) {
      console.error("Failed to stop daemon:", error);
      process.exit(1);
    }
  } else if (command === "status") {
    const info = await loadDaemonInfo();
    if (!info) {
      console.log("Daemon is not running");
      process.exit(1);
    }

    const running = await isDaemonRunning(info.pid);
    const healthy = await checkHealth(info.host, info.port);

    if (running && healthy) {
      console.log(`Daemon is running on ${info.host}:${info.port} (PID: ${info.pid})`);

      // Get active sessions
      try {
        const response = await fetch(`http://${info.host}:${info.port}/health`);
        const data = await response.json();
        console.log(`Active sessions: ${data.sessions.length > 0 ? data.sessions.join(", ") : "none"}`);
      } catch {
        console.log("Could not fetch session info");
      }
    } else {
      console.log("Daemon is not running (stale PID file)");
      await removeDaemonInfo();
      process.exit(1);
    }
  } else if (command === "restart") {
    // Stop daemon
    const info = await loadDaemonInfo();
    if (info) {
      try {
        process.kill(info.pid, "SIGTERM");
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch {
        // Ignore
      }
      await removeDaemonInfo();
    }

    // Start daemon
    const server = new DaemonServer({ port: DAEMON_PORT, host: DAEMON_HOST });
    await server.start();
    await saveDaemonInfo(process.pid, DAEMON_PORT, DAEMON_HOST);

    console.log(`Daemon restarted on ${DAEMON_HOST}:${DAEMON_PORT} (PID: ${process.pid})`);

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log("\nShutting down daemon...");
      await server.stop();
      await removeDaemonInfo();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    await new Promise(() => {});
  } else {
    console.log(`Usage: bun src/daemon/main.ts [start|stop|status|restart]`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Daemon error:", error);
  process.exit(1);
});
