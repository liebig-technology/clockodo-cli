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
});

const { registerReportCommands } = await import("../../src/commands/report.js");

const fakeGroups = [
  { name: "Website", group: "1", duration: 7200 },
  { name: "API", group: "2", duration: 3600 },
];

const fakeEntries = [
  {
    id: 1,
    type: 1,
    customersId: 10,
    projectsId: 100,
    servicesId: 1000,
    timeSince: "2026-02-23T07:00:00Z",
    timeUntil: "2026-02-23T08:00:00Z",
    duration: 3600,
    text: "Backend API refactoring",
  },
  {
    id: 2,
    type: 1,
    customersId: 10,
    projectsId: 100,
    servicesId: 1000,
    timeSince: "2026-02-23T09:00:00Z",
    timeUntil: "2026-02-23T10:30:00Z",
    duration: 5400,
    text: "Backend API refactoring",
  },
  {
    id: 3,
    type: 1,
    customersId: 10,
    projectsId: 101,
    servicesId: 1000,
    timeSince: "2026-02-23T10:30:00Z",
    timeUntil: "2026-02-23T11:30:00Z",
    duration: 3600,
    text: "Code Reviews",
  },
  {
    id: 4,
    type: 1,
    customersId: 10,
    projectsId: 101,
    servicesId: 1000,
    timeSince: "2026-02-23T12:00:00Z",
    timeUntil: "2026-02-23T12:30:00Z",
    duration: 1800,
    text: null,
  },
];

describe("report today", () => {
  it("calls getEntryGroups with today's range", async () => {
    client.getEntryGroups.mockResolvedValue({ groups: fakeGroups });

    const result = await runCommand(registerReportCommands, ["report", "today", "--json"]);
    const json = result.parseJson();

    expect(client.getEntryGroups).toHaveBeenCalledOnce();
    const args = client.getEntryGroups.mock.calls[0]?.[0] as Record<string, unknown>;
    // Local midnight → UTC may shift the date; just verify ISO format without ms
    expect(args.timeSince).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(args.timeUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect((json.data as Record<string, unknown>).groups).toBeDefined();
  });
});

describe("report week", () => {
  it("calls getEntryGroups with Monday-Sunday range", async () => {
    client.getEntryGroups.mockResolvedValue({ groups: fakeGroups });

    await runCommand(registerReportCommands, ["report", "week", "--json"]);

    expect(client.getEntryGroups).toHaveBeenCalledOnce();
    const args = client.getEntryGroups.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.timeSince).toBeDefined();
    expect(args.timeUntil).toBeDefined();
  });
});

describe("report JSON output", () => {
  it("returns groups and total in JSON mode", async () => {
    client.getEntryGroups.mockResolvedValue({ groups: fakeGroups });

    const result = await runCommand(registerReportCommands, ["report", "today", "--json"]);
    const data = result.parseJson().data as Record<string, unknown>;

    expect(data.groups).toBeInstanceOf(Array);
    expect(data.total).toBeDefined();
    expect((data.total as Record<string, unknown>).seconds).toBe(10800);
  });
});

describe("report --group text", () => {
  it("uses getEntries instead of getEntryGroups for text grouping", async () => {
    client.getEntries.mockResolvedValue({ entries: fakeEntries });

    await runCommand(registerReportCommands, ["report", "today", "--group", "text", "--json"]);

    expect(client.getEntries).toHaveBeenCalledOnce();
    expect(client.getEntryGroups).not.toHaveBeenCalled();
  });

  it("passes correct date range to getEntries", async () => {
    client.getEntries.mockResolvedValue({ entries: fakeEntries });

    await runCommand(registerReportCommands, ["report", "today", "--group", "text", "--json"]);

    const args = client.getEntries.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.timeSince).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(args.timeUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("groups entries by text and returns sorted by duration descending", async () => {
    client.getEntries.mockResolvedValue({ entries: fakeEntries });

    const result = await runCommand(registerReportCommands, [
      "report",
      "today",
      "--group",
      "text",
      "--json",
    ]);
    const data = result.parseJson().data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;

    expect(groups).toHaveLength(3);
    // "Backend API refactoring" = 3600 + 5400 = 9000s (largest)
    expect(groups[0]?.key).toBe("Backend API refactoring");
    expect(groups[0]?.count).toBe(2);
    expect(groups[0]?.seconds).toBe(9000);
    // "Code Reviews" = 3600s
    expect(groups[1]?.key).toBe("Code Reviews");
    expect(groups[1]?.count).toBe(1);
    expect(groups[1]?.seconds).toBe(3600);
    // null text → "(no description)" = 1800s
    expect(groups[2]?.key).toBe("(no description)");
    expect(groups[2]?.count).toBe(1);
    expect(groups[2]?.seconds).toBe(1800);
  });

  it("includes time ranges per group", async () => {
    client.getEntries.mockResolvedValue({ entries: fakeEntries });

    const result = await runCommand(registerReportCommands, [
      "report",
      "today",
      "--group",
      "text",
      "--json",
    ]);
    const data = result.parseJson().data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;

    const firstGroup = groups[0];
    const timeRanges = firstGroup?.timeRanges as Array<Record<string, string>>;
    expect(timeRanges).toHaveLength(2);
    expect(timeRanges[0]).toEqual({
      since: "2026-02-23T07:00:00Z",
      until: "2026-02-23T08:00:00Z",
    });
    expect(timeRanges[1]).toEqual({
      since: "2026-02-23T09:00:00Z",
      until: "2026-02-23T10:30:00Z",
    });
  });

  it("computes correct total across all groups", async () => {
    client.getEntries.mockResolvedValue({ entries: fakeEntries });

    const result = await runCommand(registerReportCommands, [
      "report",
      "today",
      "--group",
      "text",
      "--json",
    ]);
    const data = result.parseJson().data as Record<string, unknown>;
    const total = data.total as Record<string, unknown>;

    // 3600 + 5400 + 3600 + 1800 = 14400s
    expect(total.seconds).toBe(14400);
  });

  it("handles empty entries", async () => {
    client.getEntries.mockResolvedValue({ entries: [] });

    const result = await runCommand(registerReportCommands, [
      "report",
      "today",
      "--group",
      "text",
      "--json",
    ]);
    const data = result.parseJson().data as Record<string, unknown>;
    const groups = data.groups as Array<unknown>;

    expect(groups).toHaveLength(0);
    expect((data.total as Record<string, unknown>).seconds).toBe(0);
  });

  it("works with week subcommand", async () => {
    client.getEntries.mockResolvedValue({ entries: fakeEntries });

    await runCommand(registerReportCommands, ["report", "week", "--group", "text", "--json"]);

    expect(client.getEntries).toHaveBeenCalledOnce();
    expect(client.getEntryGroups).not.toHaveBeenCalled();
  });

  it("uses running duration for entries without timeUntil", async () => {
    const runningEntry = {
      id: 5,
      type: 1,
      customersId: 10,
      projectsId: 100,
      servicesId: 1000,
      timeSince: new Date(Date.now() - 1800 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
      timeUntil: null,
      duration: null,
      text: "Running task",
    };
    client.getEntries.mockResolvedValue({ entries: [runningEntry] });

    const result = await runCommand(registerReportCommands, [
      "report",
      "today",
      "--group",
      "text",
      "--json",
    ]);
    const data = result.parseJson().data as Record<string, unknown>;
    const groups = data.groups as Array<Record<string, unknown>>;

    // Running for ~30 min, should be > 0 (not the 0 that duration ?? 0 would give)
    expect(groups[0]?.seconds).toBeGreaterThan(0);
  });
});

describe("report --group validation", () => {
  it("throws INVALID_ARGS for unknown group field", async () => {
    try {
      await runCommand(registerReportCommands, ["report", "today", "--group", "invalid", "--json"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.INVALID_ARGS);
    }
  });
});
