import type { TimeEntry } from "clockodo";
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

const { registerStatusCommand } = await import("../../src/commands/status.js");

describe("status", () => {
  it("returns running clock data in JSON mode", async () => {
    const running = {
      id: 1,
      customersId: 10,
      projectsId: 20,
      servicesId: 30,
      text: "Working on tests",
      timeSince: "2026-02-20T09:00:00Z",
      type: 1,
    } as TimeEntry;

    client.getClock.mockResolvedValue({ running, currentTime: "2026-02-20T12:00:00Z" });
    client.getEntries.mockResolvedValue({ entries: [] });

    const result = await runCommand(registerStatusCommand, ["status", "--json"]);
    const json = result.parseJson();
    const data = json.data as Record<string, unknown>;

    expect(data.running).toBeDefined();
    expect((data.running as Record<string, unknown>).id).toBe(1);
    expect((data.running as Record<string, unknown>).text).toBe("Working on tests");
  });

  it("returns null when no clock is active", async () => {
    client.getClock.mockResolvedValue({ running: null, currentTime: "2026-02-20T12:00:00Z" });
    client.getEntries.mockResolvedValue({ entries: [] });

    const result = await runCommand(registerStatusCommand, ["status", "--json"]);
    const data = result.parseJson().data as Record<string, unknown>;

    expect(data.running).toBeNull();
  });

  it("calls getEntries with today's date range", async () => {
    client.getClock.mockResolvedValue({ running: null, currentTime: "2026-02-20T12:00:00Z" });
    client.getEntries.mockResolvedValue({ entries: [] });

    await runCommand(registerStatusCommand, ["status", "--json"]);

    expect(client.getEntries).toHaveBeenCalledOnce();
    const args = client.getEntries.mock.calls[0]?.[0] as Record<string, string>;
    // Local midnight → UTC may shift the date; just verify ISO format without ms
    expect(args.timeSince).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(args.timeUntil).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });
});

describe("status --prompt", () => {
  const running = {
    id: 1,
    customersId: 10,
    projectsId: 20,
    servicesId: 30,
    text: "Working on tests",
    timeSince: "2026-02-20T09:00:00Z",
    type: 1,
  } as TimeEntry;

  it("returns structured JSON when clock is running", async () => {
    client.getClock.mockResolvedValue({ running, currentTime: "2026-02-20T12:00:00Z" });

    const result = await runCommand(registerStatusCommand, ["status", "--prompt", "--json"]);
    const data = result.parseJson().data as Record<string, unknown>;

    expect(data.running).toBe(true);
    expect(data.text).toBe("Working on tests");
    expect(typeof data.elapsed).toBe("number");
    expect(typeof data.formatted).toBe("string");
  });

  it("returns running=false when no clock is active", async () => {
    client.getClock.mockResolvedValue({ running: null, currentTime: "2026-02-20T12:00:00Z" });

    const result = await runCommand(registerStatusCommand, ["status", "--prompt", "--json"]);
    const data = result.parseJson().data as Record<string, unknown>;

    expect(data.running).toBe(false);
    expect(data.text).toBeNull();
    expect(data.elapsed).toBe(0);
  });

  it("does not call getEntries (performance)", async () => {
    client.getClock.mockResolvedValue({ running, currentTime: "2026-02-20T12:00:00Z" });

    await runCommand(registerStatusCommand, ["status", "--prompt", "--json"]);

    expect(client.getEntries).not.toHaveBeenCalled();
  });

  it("returns text=null when running entry has no description", async () => {
    const noText = { ...running, text: null } as unknown as TimeEntry;
    client.getClock.mockResolvedValue({ running: noText, currentTime: "2026-02-20T12:00:00Z" });

    const result = await runCommand(registerStatusCommand, ["status", "--prompt", "--json"]);
    const data = result.parseJson().data as Record<string, unknown>;

    expect(data.running).toBe(true);
    expect(data.text).toBeNull();
  });
});
