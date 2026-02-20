import { CommanderError } from "commander";
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

const { registerAbsencesCommands } = await import("../../src/commands/absences.js");

const fakeAbsence = {
  id: 1,
  usersId: 42,
  dateSince: "2026-06-01",
  dateUntil: "2026-06-05",
  type: 1,
  status: 1,
  countDays: 5,
  countHours: null,
  note: "Summer vacation",
  publicNote: null,
  dateEnquired: "2026-05-01",
  dateApproved: "2026-05-02",
};

describe("absences list", () => {
  it("calls getAbsences with current year by default", async () => {
    client.getAbsences.mockResolvedValue({ data: [fakeAbsence] });

    const result = await runCommand(registerAbsencesCommands, ["absences", "list", "--json"]);
    const json = result.parseJson();

    expect(client.getAbsences).toHaveBeenCalledOnce();
    const args = client.getAbsences.mock.calls[0]?.[0] as Record<string, unknown>;
    const filter = args.filter as Record<string, unknown>;
    expect(filter.year).toEqual([new Date().getFullYear()]);
    expect(json.data).toBeInstanceOf(Array);
  });

  it("calls getAbsences with explicit year filter", async () => {
    client.getAbsences.mockResolvedValue({ data: [fakeAbsence] });

    await runCommand(registerAbsencesCommands, ["absences", "list", "--year", "2025", "--json"]);

    const args = client.getAbsences.mock.calls[0]?.[0] as Record<string, unknown>;
    const filter = args.filter as Record<string, unknown>;
    expect(filter.year).toEqual([2025]);
  });

  it("passes user/type/status filters", async () => {
    client.getAbsences.mockResolvedValue({ data: [fakeAbsence] });

    await runCommand(registerAbsencesCommands, [
      "absences",
      "list",
      "--user",
      "42",
      "--type",
      "1",
      "--status",
      "1",
      "--json",
    ]);

    const args = client.getAbsences.mock.calls[0]?.[0] as Record<string, unknown>;
    const filter = args.filter as Record<string, unknown>;
    expect(filter.usersId).toEqual([42]);
    expect(filter.type).toEqual([1]);
    expect(filter.status).toEqual([1]);
  });

  it("handles empty results", async () => {
    client.getAbsences.mockResolvedValue({ data: [] });

    const result = await runCommand(registerAbsencesCommands, ["absences", "list", "--json"]);
    const json = result.parseJson();

    expect(json.data).toEqual([]);
    expect((json.meta as Record<string, unknown>).count).toBe(0);
  });
});

describe("absences get", () => {
  it("calls getAbsence with parsed ID", async () => {
    client.getAbsence.mockResolvedValue({ data: fakeAbsence });

    const result = await runCommand(registerAbsencesCommands, ["absences", "get", "1", "--json"]);

    expect(client.getAbsence).toHaveBeenCalledWith({ id: 1 });
    expect(result.parseJson().data).toBeDefined();
  });

  it("returns absence detail in JSON", async () => {
    client.getAbsence.mockResolvedValue({ data: fakeAbsence });

    const result = await runCommand(registerAbsencesCommands, ["absences", "get", "1", "--json"]);
    const json = result.parseJson();

    expect((json.data as Record<string, unknown>).id).toBe(1);
    expect((json.data as Record<string, unknown>).dateSince).toBe("2026-06-01");
  });
});

describe("absences create", () => {
  it("calls addAbsence with required params", async () => {
    client.addAbsence.mockResolvedValue({ data: fakeAbsence });

    const result = await runCommand(registerAbsencesCommands, [
      "absences",
      "create",
      "--since",
      "2026-06-01",
      "--until",
      "2026-06-05",
      "--type",
      "1",
      "--json",
    ]);

    expect(client.addAbsence).toHaveBeenCalledOnce();
    const args = client.addAbsence.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.dateSince).toBe("2026-06-01");
    expect(args.dateUntil).toBe("2026-06-05");
    expect(args.type).toBe(1);
    expect(result.parseJson().data).toBeDefined();
  });

  it("passes optional flags", async () => {
    client.addAbsence.mockResolvedValue({ data: fakeAbsence });

    await runCommand(registerAbsencesCommands, [
      "absences",
      "create",
      "--since",
      "2026-06-01",
      "--until",
      "2026-06-05",
      "--type",
      "4",
      "--half-day",
      "--sick-note",
      "--note",
      "Flu",
      "--public-note",
      "Out sick",
      "--json",
    ]);

    const args = client.addAbsence.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.halfDay).toBe(true);
    expect(args.sickNote).toBe(true);
    expect(args.note).toBe("Flu");
    expect(args.publicNote).toBe("Out sick");
  });

  it("throws INVALID_ARGS when --since is missing", async () => {
    try {
      await runCommand(registerAbsencesCommands, ["absences", "create", "--type", "1", "--json"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CommanderError);
    }
  });

  it("throws INVALID_ARGS when --type is missing", async () => {
    try {
      await runCommand(registerAbsencesCommands, [
        "absences",
        "create",
        "--since",
        "2026-06-01",
        "--until",
        "2026-06-05",
        "--json",
      ]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CommanderError);
    }
  });
});

describe("absences update", () => {
  it("calls editAbsence with ID and updated fields", async () => {
    client.editAbsence.mockResolvedValue({ data: fakeAbsence });

    const result = await runCommand(registerAbsencesCommands, [
      "absences",
      "update",
      "1",
      "--since",
      "2026-06-02",
      "--note",
      "Updated note",
      "--json",
    ]);

    expect(client.editAbsence).toHaveBeenCalledOnce();
    const args = client.editAbsence.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.id).toBe(1);
    expect(args.dateSince).toBe("2026-06-02");
    expect(args.note).toBe("Updated note");
    expect(result.parseJson().data).toBeDefined();
  });

  it("passes half-day and sick-note flags", async () => {
    client.editAbsence.mockResolvedValue({ data: fakeAbsence });

    await runCommand(registerAbsencesCommands, [
      "absences",
      "update",
      "1",
      "--half-day",
      "--sick-note",
      "--json",
    ]);

    const args = client.editAbsence.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.halfDay).toBe(true);
    expect(args.sickNote).toBe(true);
  });

  it("passes --no-half-day and --no-sick-note as false", async () => {
    client.editAbsence.mockResolvedValue({ data: fakeAbsence });

    await runCommand(registerAbsencesCommands, [
      "absences",
      "update",
      "1",
      "--no-half-day",
      "--no-sick-note",
      "--json",
    ]);

    const args = client.editAbsence.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.halfDay).toBe(false);
    expect(args.sickNote).toBe(false);
  });
});

describe("absences delete", () => {
  it("calls deleteAbsence with --force", async () => {
    client.deleteAbsence.mockResolvedValue({ success: true });

    const result = await runCommand(registerAbsencesCommands, [
      "absences",
      "delete",
      "1",
      "--force",
      "--json",
    ]);

    expect(client.deleteAbsence).toHaveBeenCalledWith({ id: 1 });
    expect(result.parseJson().data).toBeDefined();
  });

  it("returns success confirmation in JSON", async () => {
    client.deleteAbsence.mockResolvedValue({ success: true });

    const result = await runCommand(registerAbsencesCommands, [
      "absences",
      "delete",
      "1",
      "--force",
      "--json",
    ]);

    const json = result.parseJson();
    expect((json.data as Record<string, unknown>).success).toBe(true);
    expect((json.data as Record<string, unknown>).id).toBe(1);
  });
});
