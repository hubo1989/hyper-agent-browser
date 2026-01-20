import type { SessionManager } from "../session/manager";

export interface SessionListOptions {
  json?: boolean;
}

export async function listSessions(
  sessionManager: SessionManager,
  options: SessionListOptions = {},
): Promise<string> {
  const sessions = await sessionManager.list();

  if (options.json) {
    return JSON.stringify(sessions, null, 2);
  }

  if (sessions.length === 0) {
    return "No sessions found.";
  }

  const lines: string[] = [];
  lines.push(
    "SESSION".padEnd(15) +
      "STATUS".padEnd(10) +
      "BROWSER".padEnd(12) +
      "URL".padEnd(40) +
      "LAST ACTIVE",
  );
  lines.push("-".repeat(100));

  for (const session of sessions) {
    const name = session.name.padEnd(15);
    const status = session.status.padEnd(10);
    const browser = (session.channel || "-").padEnd(12);
    const url = (session.url || "-").slice(0, 38).padEnd(40);
    const lastActive = formatLastActive(session.lastActiveAt);

    lines.push(`${name}${status}${browser}${url}${lastActive}`);
  }

  return lines.join("\n");
}

function formatLastActive(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export async function closeSession(
  sessionManager: SessionManager,
  sessionName?: string,
  closeAll = false,
): Promise<string> {
  if (closeAll) {
    await sessionManager.closeAll();
    return "All sessions closed.";
  }

  if (!sessionName) {
    throw new Error("Session name required");
  }

  const session = await sessionManager.get(sessionName);
  if (!session) {
    throw new Error(`Session not found: ${sessionName}`);
  }

  await sessionManager.close(sessionName);
  return `Session closed: ${sessionName}`;
}
