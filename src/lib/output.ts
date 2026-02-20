import { styleText } from "node:util";
import Table from "cli-table3";
import type { CommandResult, GlobalOptions, OutputMode } from "../types/index.js";

/** Determine output mode from flags and environment */
export function resolveOutputMode(options: GlobalOptions): OutputMode {
  if (options.json) return "json";
  if (options.plain) return "plain";

  // Auto-JSON when stdout is not a TTY (piped)
  if (!process.stdout.isTTY && process.env.CLOCKODO_AUTO_JSON !== "0") {
    return "json";
  }

  return "human";
}

/** Print a command result in the appropriate format */
export function printResult<T>(result: CommandResult<T>, options: GlobalOptions): void {
  const mode = resolveOutputMode(options);

  switch (mode) {
    case "json":
      console.log(JSON.stringify(result, null, 2));
      break;
    case "plain":
      console.log(JSON.stringify(result.data));
      break;
    case "human":
      // Human mode is handled by each command individually
      // This is a fallback for simple data
      console.log(result.data);
      break;
  }
}

/** Print a table for human-readable output */
export function printTable(headers: string[], rows: string[][], options?: GlobalOptions): void {
  const mode = resolveOutputMode(options ?? {});

  if (mode === "json" || mode === "plain") {
    // For non-human modes, output as structured data
    const data = rows.map((row) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i] ?? `col${i}`;
        obj[key] = row[i] ?? "";
      }
      return obj;
    });
    console.log(JSON.stringify(mode === "json" ? { data } : data, null, mode === "json" ? 2 : 0));
    return;
  }

  const table = new Table({
    head: headers.map((h) => styleText("bold", h)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(row);
  }

  console.log(table.toString());
}

/** Print a key-value detail view */
export function printDetail(
  entries: Array<[string, string | number | boolean | null | undefined]>,
  options?: GlobalOptions,
): void {
  const mode = resolveOutputMode(options ?? {});

  if (mode === "json" || mode === "plain") {
    const obj: Record<string, unknown> = {};
    for (const [key, value] of entries) {
      obj[key] = value;
    }
    console.log(
      JSON.stringify(mode === "json" ? { data: obj } : obj, null, mode === "json" ? 2 : 0),
    );
    return;
  }

  const maxKeyLen = Math.max(...entries.map(([k]) => k.length));
  for (const [key, value] of entries) {
    const label = styleText("bold", key.padEnd(maxKeyLen));
    console.log(`  ${label}  ${value ?? styleText("dim", "—")}`);
  }
}

/** Print a success message (stderr, so it doesn't pollute stdout for piping) */
export function printSuccess(message: string): void {
  console.error(styleText("green", `✓ ${message}`));
}

/** Print a warning message */
export function printWarning(message: string): void {
  console.error(styleText("yellow", `⚠ ${message}`));
}

/** Print an info message */
export function printInfo(message: string): void {
  console.error(styleText("cyan", `ℹ ${message}`));
}
