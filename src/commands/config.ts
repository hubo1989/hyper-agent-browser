import { loadConfig, saveConfig, getConfigValue, setConfigValue } from "../utils/config";

export async function listConfig(): Promise<string> {
  const config = await loadConfig();
  return JSON.stringify(config, null, 2);
}

export async function getConfig(key: string): Promise<string> {
  const value = await getConfigValue(key);

  if (value === undefined) {
    throw new Error(`Config key not found: ${key}`);
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export async function setConfig(key: string, value: string): Promise<string> {
  // Parse value
  let parsedValue: unknown = value;

  // Try to parse as JSON first
  if (value === "true") {
    parsedValue = true;
  } else if (value === "false") {
    parsedValue = false;
  } else if (!isNaN(Number(value))) {
    parsedValue = Number(value);
  } else {
    try {
      parsedValue = JSON.parse(value);
    } catch {
      // Keep as string
      parsedValue = value;
    }
  }

  await setConfigValue(key, parsedValue);
  return `Config updated: ${key} = ${JSON.stringify(parsedValue)}`;
}
