import { z } from "zod";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

export const ConfigSchema = z.object({
  version: z.string(),
  defaults: z.object({
    session: z.string(),
    headed: z.boolean(),
    channel: z.enum(["chrome", "msedge", "chromium"]),
    timeout: z.number(),
  }),
  sessions: z
    .object({
      dataDir: z.string(),
    })
    .optional(),
  browser: z
    .object({
      args: z.array(z.string()).optional(),
      ignoreDefaultArgs: z.array(z.string()).optional(),
    })
    .optional(),
  snapshot: z
    .object({
      interactiveRoles: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

const DEFAULT_CONFIG: Config = {
  version: "1.0",
  defaults: {
    session: "default",
    headed: false,
    channel: "chrome",
    timeout: 30000,
  },
  sessions: {
    dataDir: join(homedir(), ".hab", "sessions"),
  },
  browser: {
    args: ["--disable-blink-features=AutomationControlled"],
    ignoreDefaultArgs: ["--enable-automation"],
  },
  snapshot: {
    interactiveRoles: [
      "button",
      "link",
      "textbox",
      "checkbox",
      "radio",
      "combobox",
      "menuitem",
      "tab",
    ],
  },
};

export function getConfigPath(): string {
  const envPath = process.env.HAB_CONFIG;
  if (envPath) {
    return envPath;
  }
  return join(homedir(), ".hab", "config.json");
}

export async function loadConfig(): Promise<Config> {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = await readFile(configPath, "utf-8");
    const data = JSON.parse(content);
    const validated = ConfigSchema.parse(data);
    return validated;
  } catch (error) {
    console.error(`Warning: Failed to load config from ${configPath}:`, error);
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const configPath = getConfigPath();
  const configDir = join(configPath, "..");

  // Ensure directory exists
  if (!existsSync(configDir)) {
    await mkdir(configDir, { recursive: true, mode: 0o700 });
  }

  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

  // Security: Set file permissions to 0o600 (owner read/write only)
  // Protects sensitive configuration from other users
  const { chmod } = await import("node:fs/promises");
  await chmod(configPath, 0o600);
}

export async function getConfigValue(key: string): Promise<unknown> {
  const config = await loadConfig();
  const keys = key.split(".");

  let value: any = config;
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return undefined;
    }
  }

  return value;
}

// Whitelist of config keys that can be modified via CLI
const ALLOWED_CONFIG_KEYS = [
  "defaults.session",
  "defaults.headed",
  "defaults.channel",
  "defaults.timeout",
];

// Dangerous browser arguments that should be blocked
const DANGEROUS_BROWSER_ARGS = [
  "remote-debugging-port",
  "disable-web-security",
  "disable-site-isolation",
  "disable-features=IsolateOrigins",
  "disable-setuid-sandbox",
];

export async function setConfigValue(key: string, value: unknown): Promise<void> {
  // Security: Whitelist check - only allow safe config keys
  if (!ALLOWED_CONFIG_KEYS.includes(key)) {
    throw new Error(
      `Config key '${key}' cannot be modified via CLI. ` +
      `Allowed keys: ${ALLOWED_CONFIG_KEYS.join(", ")}`
    );
  }

  // Security: Validate browser.args if being set
  if (key === "browser.args" && Array.isArray(value)) {
    for (const arg of value as string[]) {
      for (const dangerous of DANGEROUS_BROWSER_ARGS) {
        if (arg.toLowerCase().includes(dangerous)) {
          throw new Error(`Dangerous browser argument blocked: ${arg}`);
        }
      }
    }
  }

  const config = await loadConfig();
  const keys = key.split(".");

  if (keys.length === 0) {
    throw new Error("Invalid config key");
  }

  let obj: any = config;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in obj) || typeof obj[k] !== "object") {
      obj[k] = {};
    }
    obj = obj[k];
  }

  const lastKey = keys[keys.length - 1];
  obj[lastKey] = value;

  // Validate updated config
  ConfigSchema.parse(config);

  await saveConfig(config);
}
