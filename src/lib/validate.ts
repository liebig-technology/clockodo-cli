import { CliError, ExitCode } from "./errors.js";

/** Parse and validate a string as a positive integer ID */
export function parseId(input: string, label = "ID"): number {
  const num = Number(input);
  if (!Number.isInteger(num) || num <= 0) {
    throw new CliError(
      `Invalid ${label}: "${input}". Must be a positive integer.`,
      ExitCode.INVALID_ARGS,
    );
  }
  return num;
}

/** Strict integer parser for Commander option flags */
export function parseIntStrict(value: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new CliError(`"${value}" is not a valid positive integer.`, ExitCode.INVALID_ARGS);
  }
  return num;
}
