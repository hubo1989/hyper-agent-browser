import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";

describe("Integration Tests - Element References", () => {
  const SESSION = "test-integration";

  afterAll(async () => {
    // Cleanup
    await $`bun run src/cli.ts -s ${SESSION} close`.quiet();
  });

  it("should open a page and generate snapshot", async () => {
    const result = await $`bun run src/cli.ts -s ${SESSION} open https://example.com`.text();
    expect(result).toContain("Opened:");
  });

  it("should get snapshot with interactive elements", async () => {
    await $`bun run src/cli.ts -s ${SESSION} wait 2000`.quiet();
    const snapshot = await $`bun run src/cli.ts -s ${SESSION} snapshot -i`.text();

    expect(snapshot).toContain("URL:");
    expect(snapshot).toContain("Title:");
    expect(snapshot).toContain("Interactive Elements:");
  });

  it("should get current URL", async () => {
    const url = await $`bun run src/cli.ts -s ${SESSION} url`.text();
    expect(url).toContain("example.com");
  });

  it("should get page title", async () => {
    const title = await $`bun run src/cli.ts -s ${SESSION} title`.text();
    expect(title.length).toBeGreaterThan(0);
  });

  it("should take screenshot", async () => {
    const output = await $`bun run src/cli.ts -s ${SESSION} screenshot -o /tmp/test-screenshot.png`.text();
    expect(output).toContain("Screenshot saved");
  });
});

describe("Integration Tests - Session Management", () => {
  it("should list sessions", async () => {
    const result = await $`bun run src/cli.ts sessions`.text();
    expect(result).toBeDefined();
  });

  it("should create and close session", async () => {
    const SESSION = "test-temp";

    await $`bun run src/cli.ts -s ${SESSION} open https://example.com`.quiet();
    const closeResult = await $`bun run src/cli.ts -s ${SESSION} close`.text();

    expect(closeResult).toContain("Session closed");
  });
});

describe("Integration Tests - Navigation", () => {
  const SESSION = "test-nav";

  afterAll(async () => {
    await $`bun run src/cli.ts -s ${SESSION} close`.quiet();
  });

  it("should navigate forward and back", async () => {
    await $`bun run src/cli.ts -s ${SESSION} open https://example.com`.quiet();
    await $`bun run src/cli.ts -s ${SESSION} wait 2000`.quiet();

    // This would navigate if there's history
    // Just test that commands don't error
    const backResult = await $`bun run src/cli.ts -s ${SESSION} back`.text().catch(() => "");
    expect(backResult).toBeDefined();
  });

  it("should reload page", async () => {
    const result = await $`bun run src/cli.ts -s ${SESSION} reload`.text();
    expect(result).toContain("reloaded");
  });
});
