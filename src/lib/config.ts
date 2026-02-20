import { chmodSync } from "node:fs";
import Conf from "conf";
import type { CliConfig } from "../types/index.js";
import { CliError, ExitCode } from "./errors.js";

const schema = {
  email: { type: "string" as const },
  apiKey: { type: "string" as const },
  defaultCustomerId: { type: "number" as const },
  defaultServiceId: { type: "number" as const },
  defaultProjectId: { type: "number" as const },
  timezone: { type: "string" as const, default: "Europe/Berlin" },
};

let configInstance: Conf<CliConfig> | null = null;

function getStore(): Conf<CliConfig> {
  if (!configInstance) {
    configInstance = new Conf<CliConfig>({
      projectName: "clockodo-cli",
      schema,
    });
    // Restrict config file to owner-only (contains API key)
    try {
      chmodSync(configInstance.path, 0o600);
    } catch {
      // Best effort -- may fail on some platforms
    }
  }
  return configInstance;
}

/** Get the full config object */
export function getConfig(): Partial<CliConfig> {
  return getStore().store;
}

/** Get a specific config value */
export function getConfigValue<K extends keyof CliConfig>(key: K): CliConfig[K] | undefined {
  return getStore().get(key);
}

/** Set a config value */
export function setConfigValue<K extends keyof CliConfig>(key: K, value: CliConfig[K]): void {
  getStore().set(key, value);
}

/** Get the config file path */
export function getConfigPath(): string {
  return getStore().path;
}

/** Validate that required auth config exists */
export function requireAuth(): { email: string; apiKey: string } {
  const email = getConfigValue("email") ?? process.env.CLOCKODO_EMAIL;
  const apiKey = getConfigValue("apiKey") ?? process.env.CLOCKODO_API_KEY;

  if (!email || !apiKey) {
    throw new CliError(
      "Authentication not configured.",
      ExitCode.CONFIG_ERROR,
      'Run "clockodo config set" to configure your API credentials, or set CLOCKODO_EMAIL and CLOCKODO_API_KEY environment variables.',
    );
  }

  return { email, apiKey };
}

/** Mask a secret string for display (show only last 4 chars) */
export function maskSecret(secret: string): string {
  if (secret.length <= 4) return "****";
  return `****${secret.slice(-4)}`;
}

/** Reset config instance (for testing) */
export function resetConfig(): void {
  configInstance = null;
}
