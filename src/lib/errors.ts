import { styleText } from "node:util";
import type { GlobalOptions } from "../types/index.js";

/** Stable exit codes for scripting/AI consumption */
export const ExitCode = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
  EMPTY_RESULTS: 3,
  AUTH_FAILURE: 4,
  NOT_FOUND: 5,
  FORBIDDEN: 6,
  RATE_LIMITED: 7,
  SERVER_ERROR: 8,
  CONFIG_ERROR: 10,
} as const;

export type ExitCodeValue = (typeof ExitCode)[keyof typeof ExitCode];

export class CliError extends Error {
  readonly exitCode: ExitCodeValue;
  readonly suggestion?: string;

  constructor(
    message: string,
    exitCode: ExitCodeValue = ExitCode.GENERAL_ERROR,
    suggestion?: string,
  ) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.suggestion = suggestion;
  }
}

/** Map HTTP status codes from Clockodo API to exit codes */
export function mapHttpError(statusCode: number): ExitCodeValue {
  switch (true) {
    case statusCode === 401:
      return ExitCode.AUTH_FAILURE;
    case statusCode === 403:
      return ExitCode.FORBIDDEN;
    case statusCode === 404:
      return ExitCode.NOT_FOUND;
    case statusCode === 429:
      return ExitCode.RATE_LIMITED;
    case statusCode >= 500:
      return ExitCode.SERVER_ERROR;
    default:
      return ExitCode.GENERAL_ERROR;
  }
}

/** Sanitize a string to remove potential credential leaks */
function sanitize(input: string): string {
  return input
    .replace(
      /([a-zA-Z]*(?:key|token|secret|password|auth|credential)[a-zA-Z]*)\s*[:=]\s*["']?[^\s"',}]+/gi,
      "$1=***",
    )
    .slice(0, 500);
}

/** Sanitize a stack trace to remove lines that may contain credentials */
function sanitizeStack(stack: string): string {
  return stack
    .split("\n")
    .filter((line) => !/apiKey|authorization|Bearer|password|secret/i.test(line))
    .join("\n");
}

/** Extract details from an Axios-style error (thrown by the clockodo SDK) */
function extractApiError(error: unknown): {
  statusCode: number;
  message: string;
  detail?: string;
} | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as Record<string, unknown>).response === "object"
  ) {
    const response = (error as { response: { status?: number; data?: unknown } }).response;
    const status = response.status ?? 0;
    const data = response.data;

    let detail: string | undefined;
    if (typeof data === "object" && data !== null) {
      const d = data as Record<string, unknown>;
      // Clockodo API returns { error: { message: "..." } } on errors
      if (typeof d.error === "object" && d.error !== null) {
        const errObj = d.error as Record<string, unknown>;
        detail = String(errObj.message ?? errObj.description ?? JSON.stringify(errObj));
      } else if (d.message) {
        detail = String(d.message);
      } else {
        detail = JSON.stringify(data);
      }
    } else if (typeof data === "string") {
      detail = data;
    }

    return {
      statusCode: status,
      message: `API error (HTTP ${status})`,
      detail: detail ? sanitize(detail) : undefined,
    };
  }
  return null;
}

/** Global error handler -- call in the main entry point */
export function handleError(error: unknown, options?: GlobalOptions): never {
  if (error instanceof CliError) {
    if (options?.json) {
      console.error(
        JSON.stringify({
          success: false,
          error: {
            code: error.exitCode,
            message: error.message,
            suggestion: error.suggestion,
          },
        }),
      );
    } else {
      console.error(styleText("red", `Error: ${error.message}`));
      if (error.suggestion) {
        console.error(styleText("yellow", `Hint: ${error.suggestion}`));
      }
    }
    process.exit(error.exitCode);
  }

  // Check for Axios/API errors from the clockodo SDK
  const apiError = extractApiError(error);
  if (apiError) {
    const exitCode = mapHttpError(apiError.statusCode);
    if (options?.json) {
      console.error(
        JSON.stringify({
          success: false,
          error: {
            code: exitCode,
            httpStatus: apiError.statusCode,
            message: apiError.message,
            detail: apiError.detail,
          },
        }),
      );
    } else {
      console.error(styleText("red", `Error: ${apiError.message}`));
      if (apiError.detail) {
        console.error(styleText("yellow", `Detail: ${apiError.detail}`));
      }
      if (options?.verbose && error instanceof Error && error.stack) {
        console.error(styleText("dim", sanitizeStack(error.stack)));
      }
    }
    process.exit(exitCode);
  }

  // Unknown errors
  const message = error instanceof Error ? error.message : String(error);
  if (options?.json) {
    console.error(JSON.stringify({ success: false, error: { code: 1, message } }));
  } else {
    console.error(styleText("red", `Unexpected error: ${message}`));
    if (options?.verbose && error instanceof Error && error.stack) {
      console.error(styleText("dim", error.stack));
    }
  }
  process.exit(ExitCode.GENERAL_ERROR);
}
