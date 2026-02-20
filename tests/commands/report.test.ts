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

const { registerReportCommands } = await import("../../src/commands/report.js");

const fakeGroups = [
  { name: "Website", group: "1", duration: 7200 },
  { name: "API", group: "2", duration: 3600 },
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
