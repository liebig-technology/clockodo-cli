import type { TimeEntry } from "clockodo";
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

const { registerClockCommands } = await import("../../src/commands/clock.js");

const fakeEntry = {
  id: 42,
  customersId: 10,
  projectsId: 20,
  servicesId: 30,
  text: "Task",
  timeSince: "2026-02-20T09:00:00Z",
  timeUntil: "2026-02-20T10:00:00Z",
  duration: 3600,
  type: 1,
} as TimeEntry;

const fakeRunningEntry = {
  id: 99,
  customersId: 10,
  projectsId: 20,
  servicesId: 30,
  text: "Running task",
  timeSince: "2026-02-20T09:00:00Z",
  timeUntil: null,
  duration: null,
  type: 1,
} as unknown as TimeEntry;

describe("start", () => {
  it("calls startClock with customer/service IDs", async () => {
    client.startClock.mockResolvedValue({
      running: fakeEntry,
      stopped: null,
      stoppedHasBeenTruncated: false,
      currentTime: "2026-02-20T09:00:00Z",
    });

    const result = await runCommand(registerClockCommands, [
      "start",
      "--customer",
      "10",
      "--service",
      "30",
      "--json",
    ]);

    expect(client.startClock).toHaveBeenCalledOnce();
    const args = client.startClock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.customersId).toBe(10);
    expect(args.servicesId).toBe(30);
    expect(result.parseJson().data).toBeDefined();
  });

  it("omits billable when neither --billable nor --no-billable is set", async () => {
    client.startClock.mockResolvedValue({
      running: fakeEntry,
      stopped: null,
      stoppedHasBeenTruncated: false,
      currentTime: "2026-02-20T09:00:00Z",
    });

    await runCommand(registerClockCommands, [
      "start",
      "--customer",
      "10",
      "--service",
      "30",
      "--json",
    ]);

    const args = client.startClock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args).not.toHaveProperty("billable");
  });

  it("passes billable when --billable is set", async () => {
    client.startClock.mockResolvedValue({
      running: fakeEntry,
      stopped: null,
      stoppedHasBeenTruncated: false,
      currentTime: "2026-02-20T09:00:00Z",
    });

    await runCommand(registerClockCommands, [
      "start",
      "--customer",
      "10",
      "--service",
      "30",
      "--billable",
      "--json",
    ]);

    const args = client.startClock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(1);
  });

  it("passes billable=0 when --no-billable is set", async () => {
    client.startClock.mockResolvedValue({
      running: fakeEntry,
      stopped: null,
      stoppedHasBeenTruncated: false,
      currentTime: "2026-02-20T09:00:00Z",
    });

    await runCommand(registerClockCommands, [
      "start",
      "--customer",
      "10",
      "--service",
      "30",
      "--no-billable",
      "--json",
    ]);

    const args = client.startClock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(0);
  });

  it("throws INVALID_ARGS when customer/service missing", async () => {
    await expect(runCommand(registerClockCommands, ["start", "--json"])).rejects.toThrow(CliError);

    try {
      await runCommand(registerClockCommands, ["start", "--json"]);
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.INVALID_ARGS);
    }
  });
});

describe("stop", () => {
  it("calls stopClock with running entry ID", async () => {
    client.getClock.mockResolvedValue({ running: fakeEntry, currentTime: "2026-02-20T10:00:00Z" });
    client.stopClock.mockResolvedValue({
      stopped: fakeEntry,
      stoppedHasBeenTruncated: false,
      running: null,
      currentTime: "2026-02-20T10:00:00Z",
    });

    const result = await runCommand(registerClockCommands, ["stop", "--json"]);

    expect(client.stopClock).toHaveBeenCalledWith({ entriesId: 42 });
    expect(result.parseJson().data).toBeDefined();
  });

  it("throws EMPTY_RESULTS when no clock running", async () => {
    client.getClock.mockResolvedValue({ running: null, currentTime: "2026-02-20T10:00:00Z" });

    try {
      await runCommand(registerClockCommands, ["stop", "--json"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.EMPTY_RESULTS);
    }
  });
});

describe("edit", () => {
  it("calls editEntry with text when --text provided", async () => {
    client.getClock.mockResolvedValue({
      running: fakeRunningEntry,
      currentTime: "2026-02-20T10:00:00Z",
    });
    client.editEntry.mockResolvedValue({
      entry: { ...fakeRunningEntry, text: "Updated" },
      running: fakeRunningEntry,
    });

    const result = await runCommand(registerClockCommands, ["edit", "--text", "Updated", "--json"]);

    expect(client.editEntry).toHaveBeenCalledWith({ id: 99, text: "Updated" });
    expect(result.parseJson().data).toBeDefined();
  });

  it("calls editEntry with customer/project/service IDs", async () => {
    client.getClock.mockResolvedValue({
      running: fakeRunningEntry,
      currentTime: "2026-02-20T10:00:00Z",
    });
    client.editEntry.mockResolvedValue({ entry: fakeRunningEntry, running: fakeRunningEntry });

    await runCommand(registerClockCommands, [
      "edit",
      "--customer",
      "5",
      "--project",
      "6",
      "--service",
      "7",
      "--json",
    ]);

    expect(client.editEntry).toHaveBeenCalledWith({
      id: 99,
      customersId: 5,
      projectsId: 6,
      servicesId: 7,
    });
  });

  it("calls editEntry with billable flag", async () => {
    client.getClock.mockResolvedValue({
      running: fakeRunningEntry,
      currentTime: "2026-02-20T10:00:00Z",
    });
    client.editEntry.mockResolvedValue({ entry: fakeRunningEntry, running: fakeRunningEntry });

    await runCommand(registerClockCommands, ["edit", "--billable", "--json"]);

    const args = client.editEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(1);
  });

  it("calls editEntry with not-billable flag", async () => {
    client.getClock.mockResolvedValue({
      running: fakeRunningEntry,
      currentTime: "2026-02-20T10:00:00Z",
    });
    client.editEntry.mockResolvedValue({ entry: fakeRunningEntry, running: fakeRunningEntry });

    await runCommand(registerClockCommands, ["edit", "--no-billable", "--json"]);

    const args = client.editEntry.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.billable).toBe(0);
  });

  it("throws EMPTY_RESULTS when no clock running", async () => {
    client.getClock.mockResolvedValue({ running: null, currentTime: "2026-02-20T10:00:00Z" });

    try {
      await runCommand(registerClockCommands, ["edit", "--text", "foo", "--json"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.EMPTY_RESULTS);
    }
  });

  it("throws INVALID_ARGS when no flags provided", async () => {
    client.getClock.mockResolvedValue({
      running: fakeRunningEntry,
      currentTime: "2026-02-20T10:00:00Z",
    });

    try {
      await runCommand(registerClockCommands, ["edit", "--json"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.INVALID_ARGS);
    }
  });
});

describe("extend", () => {
  it("calls changeClockDuration with correct params", async () => {
    client.getClock.mockResolvedValue({
      running: fakeRunningEntry,
      currentTime: "2026-02-20T10:00:00Z",
    });
    client.changeClockDuration.mockResolvedValue({
      updated: fakeRunningEntry,
      running: fakeRunningEntry,
      currentTime: "2026-02-20T10:00:00Z",
    });

    // Mock getEntryDurationUntilNow — running entry started at 09:00, current time 10:00 = 3600s
    // We can't easily mock the SDK function, so we test the contract:
    // extend by 30 min = durationBefore + 1800
    const result = await runCommand(registerClockCommands, ["extend", "30", "--json"]);

    expect(client.changeClockDuration).toHaveBeenCalledOnce();
    const args = client.changeClockDuration.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.entriesId).toBe(99);
    expect(typeof args.durationBefore).toBe("number");
    expect(typeof args.duration).toBe("number");
    expect((args.duration as number) - (args.durationBefore as number)).toBe(1800);
    expect(result.parseJson().data).toBeDefined();
  });

  it("throws EMPTY_RESULTS when no clock running", async () => {
    client.getClock.mockResolvedValue({ running: null, currentTime: "2026-02-20T10:00:00Z" });

    try {
      await runCommand(registerClockCommands, ["extend", "30", "--json"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(ExitCode.EMPTY_RESULTS);
    }
  });
});
