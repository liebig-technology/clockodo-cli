import type { Entry } from "clockodo";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CliError, ExitCode } from "../../src/lib/errors.js";
import { createMockClient, type MockClockodo } from "../helpers/mock-client.js";
import { runCommand } from "../helpers/run-command.js";

vi.mock("../../src/lib/client.js");
vi.mock("../../src/lib/config.js");

let client: MockClockodo;

beforeEach(async () => {
  vi.resetAllMocks();
  client = createMockClient();
  const { getClient } = await import("../../src/lib/client.js");
  vi.mocked(getClient).mockReturnValue(client as unknown as ReturnType<typeof getClient>);

  const config = await import("../../src/lib/config.js");
  vi.mocked(config.getConfigValue).mockReturnValue(undefined);
});

const { registerEntriesCommands } = await import("../../src/commands/entries.js");

const fakeEntry = {
  id: 100,
  customersId: 10,
  projectsId: 20,
  servicesId: 30,
  text: "Test entry",
  timeSince: "2026-02-20T09:00:00Z",
  timeUntil: "2026-02-20T10:00:00Z",
  duration: 3600,
  type: 1,
  billable: 0,
} as unknown as Entry;

describe("entries list", () => {
  it("calls getEntries with date range and returns entries in JSON", async () => {
    client.getEntries.mockResolvedValue({ entries: [fakeEntry] });

    const result = await runCommand(registerEntriesCommands, ["entries", "list", "--json"]);
    const json = result.parseJson();

    expect(client.getEntries).toHaveBeenCalledOnce();
    const args = client.getEntries.mock.calls[0]?.[0] as Record<string, string>;
    expect(args.timeSince).toBeDefined();
    expect(args.timeUntil).toBeDefined();
    expect(json.data).toBeInstanceOf(Array);
  });
});

describe("entries get", () => {
  it("calls getEntry with parsed ID", async () => {
    client.getEntry.mockResolvedValue({ entry: fakeEntry });

    const result = await runCommand(registerEntriesCommands, ["entries", "get", "100", "--json"]);

    expect(client.getEntry).toHaveBeenCalledWith({ id: 100 });
    expect(result.parseJson().data).toBeDefined();
  });
});

describe("entries create", () => {
  it("calls addEntry with required params", async () => {
    client.addEntry.mockResolvedValue({ entry: fakeEntry });

    const result = await runCommand(registerEntriesCommands, [
      "entries",
      "create",
      "--from",
      "09:00",
      "--to",
      "10:00",
      "--customer",
      "10",
      "--service",
      "30",
      "--json",
    ]);

    expect(client.addEntry).toHaveBeenCalledOnce();
    const args = client.addEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.customersId).toBe(10);
    expect(args.servicesId).toBe(30);
    expect(result.parseJson().data).toBeDefined();
  });

  it("throws INVALID_ARGS without customer/service", async () => {
    try {
      await runCommand(registerEntriesCommands, [
        "entries",
        "create",
        "--from",
        "09:00",
        "--to",
        "10:00",
        "--json",
      ]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.INVALID_ARGS);
    }
  });
});

describe("entries delete", () => {
  it("calls deleteEntry with --force", async () => {
    client.deleteEntry.mockResolvedValue({ success: true });

    const result = await runCommand(registerEntriesCommands, [
      "entries",
      "delete",
      "100",
      "--force",
      "--json",
    ]);

    expect(client.deleteEntry).toHaveBeenCalledWith({ id: 100 });
    expect(result.parseJson().data).toBeDefined();
  });
});
