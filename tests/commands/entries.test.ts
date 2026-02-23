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

  it("passes billable filter to getEntries when --billable is set", async () => {
    client.getEntries.mockResolvedValue({ entries: [fakeEntry] });

    await runCommand(registerEntriesCommands, ["entries", "list", "--billable", "--json"]);

    const args = client.getEntries.mock.calls[0]?.[0] as Record<string, unknown>;
    const filter = args.filter as Record<string, unknown>;
    expect(filter.billable).toBe(1);
  });

  it("passes not-billable filter to getEntries when --no-billable is set", async () => {
    client.getEntries.mockResolvedValue({ entries: [fakeEntry] });

    await runCommand(registerEntriesCommands, ["entries", "list", "--no-billable", "--json"]);

    const args = client.getEntries.mock.calls[0]?.[0] as Record<string, unknown>;
    const filter = args.filter as Record<string, unknown>;
    expect(filter.billable).toBe(0);
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
    client.getCustomer.mockResolvedValue({ data: { id: 10, billableDefault: false } });
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

  it("passes billable=1 when --billable is set", async () => {
    client.addEntry.mockResolvedValue({ entry: fakeEntry });

    await runCommand(registerEntriesCommands, [
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
      "--billable",
      "--json",
    ]);

    const args = client.addEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(1);
  });

  it("passes billable=0 when --no-billable is set", async () => {
    client.addEntry.mockResolvedValue({ entry: fakeEntry });

    await runCommand(registerEntriesCommands, [
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
      "--no-billable",
      "--json",
    ]);

    const args = client.addEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(0);
  });

  it("resolves billable default from project when no flag is set", async () => {
    client.getProject.mockResolvedValue({ data: { id: 20, billableDefault: true } });
    client.addEntry.mockResolvedValue({ entry: fakeEntry });

    await runCommand(registerEntriesCommands, [
      "entries",
      "create",
      "--from",
      "09:00",
      "--to",
      "10:00",
      "--customer",
      "10",
      "--project",
      "20",
      "--service",
      "30",
      "--json",
    ]);

    const args = client.addEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(1);
  });

  it("resolves billable default from customer when no project is set", async () => {
    client.getCustomer.mockResolvedValue({ data: { id: 10, billableDefault: false } });
    client.addEntry.mockResolvedValue({ entry: fakeEntry });

    await runCommand(registerEntriesCommands, [
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

    const args = client.addEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(0);
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

describe("entries update", () => {
  it("calls editEntry with customer, project, and service", async () => {
    client.editEntry.mockResolvedValue({ entry: fakeEntry });

    const result = await runCommand(registerEntriesCommands, [
      "entries",
      "update",
      "100",
      "--customer",
      "11",
      "--project",
      "22",
      "--service",
      "33",
      "--json",
    ]);

    expect(client.editEntry).toHaveBeenCalledOnce();
    const args = client.editEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.id).toBe(100);
    expect(args.customersId).toBe(11);
    expect(args.projectsId).toBe(22);
    expect(args.servicesId).toBe(33);
    expect(result.parseJson().data).toBeDefined();
  });

  it("sends billable=1 when --billable is set", async () => {
    client.editEntry.mockResolvedValue({ entry: fakeEntry });

    await runCommand(registerEntriesCommands, ["entries", "update", "100", "--billable", "--json"]);

    const args = client.editEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(1);
  });

  it("sends billable=0 when --no-billable is set", async () => {
    client.editEntry.mockResolvedValue({ entry: fakeEntry });

    await runCommand(registerEntriesCommands, [
      "entries",
      "update",
      "100",
      "--no-billable",
      "--json",
    ]);

    const args = client.editEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(0);
  });

  it("omits unchanged fields when not provided", async () => {
    client.editEntry.mockResolvedValue({ entry: fakeEntry });

    await runCommand(registerEntriesCommands, [
      "entries",
      "update",
      "100",
      "--text",
      "new text",
      "--json",
    ]);

    const args = client.editEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.id).toBe(100);
    expect(args.text).toBe("new text");
    expect(args).not.toHaveProperty("customersId");
    expect(args).not.toHaveProperty("projectsId");
    expect(args).not.toHaveProperty("servicesId");
    expect(args).not.toHaveProperty("billable");
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
