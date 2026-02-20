/** Global CLI options available on every command */
export interface GlobalOptions {
  json?: boolean;
  plain?: boolean;
  noColor?: boolean;
  noInput?: boolean;
  verbose?: boolean;
}

/** Output mode derived from flags and environment */
export type OutputMode = "human" | "json" | "plain";

/** CLI configuration stored in ~/.config/clockodo-cli/config.json */
export interface CliConfig {
  email: string;
  apiKey: string;
  defaultCustomerId?: number;
  defaultServiceId?: number;
  defaultProjectId?: number;
  timezone?: string;
}

/** Wrapper around command results for consistent output */
export interface CommandResult<T = unknown> {
  data: T;
  meta?: Record<string, unknown>;
}
