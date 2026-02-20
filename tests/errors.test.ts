import { describe, expect, it } from "vitest";
import { CliError, ExitCode, mapHttpError } from "../src/lib/errors.js";

describe("CliError", () => {
  it("creates error with defaults", () => {
    const err = new CliError("test");
    expect(err.message).toBe("test");
    expect(err.exitCode).toBe(ExitCode.GENERAL_ERROR);
    expect(err.suggestion).toBeUndefined();
  });

  it("creates error with custom exit code and suggestion", () => {
    const err = new CliError("auth failed", ExitCode.AUTH_FAILURE, "run config set");
    expect(err.exitCode).toBe(4);
    expect(err.suggestion).toBe("run config set");
  });

  it("is instanceof Error", () => {
    const err = new CliError("test");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("mapHttpError", () => {
  it("maps 401 to AUTH_FAILURE", () => {
    expect(mapHttpError(401)).toBe(ExitCode.AUTH_FAILURE);
  });

  it("maps 404 to NOT_FOUND", () => {
    expect(mapHttpError(404)).toBe(ExitCode.NOT_FOUND);
  });

  it("maps 429 to RATE_LIMITED", () => {
    expect(mapHttpError(429)).toBe(ExitCode.RATE_LIMITED);
  });

  it("maps 500+ to SERVER_ERROR", () => {
    expect(mapHttpError(500)).toBe(ExitCode.SERVER_ERROR);
    expect(mapHttpError(503)).toBe(ExitCode.SERVER_ERROR);
  });

  it("maps unknown codes to GENERAL_ERROR", () => {
    expect(mapHttpError(400)).toBe(ExitCode.GENERAL_ERROR);
  });
});
