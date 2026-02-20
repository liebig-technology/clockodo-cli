import { beforeEach, describe, expect, it, vi } from "vitest";
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

const { registerWorktimesCommands } = await import("../../src/commands/worktimes.js");

const fakeWorkTimeDays = [
  {
    date: "2026-02-16",
    usersId: 42,
    intervals: [
      { timeSince: "2026-02-16T08:00:00Z", timeUntil: "2026-02-16T12:00:00Z" },
      { timeSince: "2026-02-16T13:00:00Z", timeUntil: "2026-02-16T17:00:00Z" },
    ],
    offset: 0,
  },
  {
    date: "2026-02-17",
    usersId: 42,
    intervals: [{ timeSince: "2026-02-17T09:00:00Z", timeUntil: "2026-02-17T17:30:00Z" }],
    offset: 0,
  },
];

describe("worktimes", () => {
  it("calls getWorkTimes and returns workTimeDays in JSON output", async () => {
    client.getWorkTimes.mockResolvedValue({ workTimeDays: fakeWorkTimeDays });

    const result = await runCommand(registerWorktimesCommands, ["worktimes", "--json"]);
    const json = result.parseJson();

    expect(client.getWorkTimes).toHaveBeenCalledOnce();
    expect(json.data).toBeInstanceOf(Array);
    expect((json.data as unknown[]).length).toBe(2);
  });

  it("defaults to current week when --since/--until are omitted", async () => {
    client.getWorkTimes.mockResolvedValue({ workTimeDays: [] });

    await runCommand(registerWorktimesCommands, ["worktimes", "--json"]);

    expect(client.getWorkTimes).toHaveBeenCalledOnce();
    const args = client.getWorkTimes.mock.calls[0]?.[0] as Record<string, string>;
    // Work times API uses YYYY-MM-DD format, not full ISO datetime
    expect(args.dateSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(args.dateUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("passes --user filter as usersId param", async () => {
    client.getWorkTimes.mockResolvedValue({ workTimeDays: fakeWorkTimeDays });

    await runCommand(registerWorktimesCommands, ["worktimes", "--user", "42", "--json"]);

    const args = client.getWorkTimes.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.usersId).toBe(42);
  });

  it("handles empty workTimeDays array", async () => {
    client.getWorkTimes.mockResolvedValue({ workTimeDays: [] });

    const result = await runCommand(registerWorktimesCommands, ["worktimes", "--json"]);
    const json = result.parseJson();

    expect(json.data).toEqual([]);
    expect((json.meta as Record<string, unknown>).count).toBe(0);
    expect((json.meta as Record<string, unknown>).totalSeconds).toBe(0);
  });

  it("includes computed stats per day in the output", async () => {
    client.getWorkTimes.mockResolvedValue({ workTimeDays: fakeWorkTimeDays });

    const result = await runCommand(registerWorktimesCommands, ["worktimes", "--json"]);
    const json = result.parseJson();
    const days = json.data as Array<Record<string, unknown>>;

    // Day 1: two intervals (08:00-12:00, 13:00-17:00) = 8h work, 1h break
    const day1Stats = days[0]?.stats as Record<string, unknown>;
    expect(day1Stats.totalSeconds).toBe(28800); // 8h
    expect(day1Stats.breakSeconds).toBe(3600); // 1h
    expect(day1Stats.intervalCount).toBe(2);
    expect(day1Stats.startTime).toBe("2026-02-16T08:00:00Z");
    expect(day1Stats.endTime).toBe("2026-02-16T17:00:00Z");

    // Day 2: one interval (09:00-17:30) = 8.5h work, 0 break
    const day2Stats = days[1]?.stats as Record<string, unknown>;
    expect(day2Stats.totalSeconds).toBe(30600); // 8.5h
    expect(day2Stats.breakSeconds).toBe(0);
    expect(day2Stats.intervalCount).toBe(1);
  });
});
